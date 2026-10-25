// invoice.service.ts => facturación electrónica (sprint 4.1): emisión automática al colocar el pedido,
// representación gráfica PDF y notas crédito vinculadas a devoluciones.
import { invoiceRepository, type InvoiceRepository } from "../repository/invoice.repository";
import { buildUblInvoice, computeCufe, SandboxDianGateway, type DianGateway } from "../model/invoice.model";
import { CreditNoteExceedsInvoiceException, InvoiceNotFoundException, OrderNotInvoiceableException } from "../exception/invoice.exception";
import type { InvoiceDetailDto, InvoiceSummaryDto } from "../dto/invoice.dto";
import type { BuyerInput } from "../schema/invoice.schema";
import { renderInvoicePdf } from "../util/pdf.util";
import { commerceEvents } from "../../order/event/order.event";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { sha384 } from "../../../shared/util/crypto.util";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import type { ResolutionInput } from "../schema/invoice.schema";
import { emailService } from "../../email/service/email.service";
import { EmailTemplates } from "../../email/util/template.util";
import { MESSAGES } from "../../../shared/constants/messages.constants";
import { DEFAULT_LOCALE, isLocale } from "../../../shared/util/i18n.util";
import { toCsv } from "../../../shared/util/spreadsheet.util";
import { ConflictException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";

const SYSTEM_VIEWER = { id: "system", roles: ["ADMIN"] }; // Procesos internos (envío automático por correo)
const RESOLUTION_ALERT_RATIO = 0.1; // Avisar cuando quede menos del 10 % del rango autorizado
const RESOLUTION_ALERT_DAYS = 30; // ...o cuando falten menos de 30 días para vencer

export const SELLER_NAME = "eCommerce Web3 S.A.S."; // Razón social (factura y órdenes de compra)

interface Viewer {
  id: string;
  roles: string[];
}

export class InvoiceService {
  constructor(
    private readonly repository: InvoiceRepository,
    private readonly dian: DianGateway // Puerto hacia la DIAN (inyectable: sandbox o producción)
  ) {}

  // createInvoice => "generar factura electrónica y enviar a DIAN" (idempotente: una factura por pedido)
  public async createInvoice(orderId: string, buyerOverride?: BuyerInput): Promise<InvoiceDetailDto> {
    const existing = await this.repository.findByOrder(orderId);
    if (existing) return existing;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!order || order.status === "CANCELLED") throw new OrderNotInvoiceableException();

    // Consumidor final (documento genérico 222222222222) si el cliente no aportó datos fiscales
    const buyer: BuyerInput = buyerOverride ?? {
      documentType: "CC",
      documentNumber: "222222222222",
      name: `${order.user.firstName} ${order.user.lastName}`,
      email: order.user.email,
    };
    // RF-11.3 numeración: consecutivo de la resolución DIAN vigente; sin resolución registrada se usa el prefijo de
    // pruebas del .env (ambiente de habilitación) para no detener la venta
    const issuedAt = new Date();
    const resolution = await this.repository.takeResolutionNumber(issuedAt);
    if (!resolution) logger.warn("invoice_without_dian_resolution", { orderId });
    const number = resolution ? `${resolution.prefix}${resolution.number}` : `${appConfig.DIAN_INVOICE_PREFIX}${await this.repository.nextInvoiceNumber()}`;
    // Base gravable = subtotal - descuento + envío; el IVA ya se calculó en el checkout sobre productos
    const subtotalCents = order.totalCents - order.taxCents;
    const cufe = computeCufe({
      number,
      issuedAt,
      subtotalCents,
      ivaCents: order.taxCents,
      totalCents: order.totalCents,
      sellerNit: appConfig.DIAN_SELLER_NIT,
      buyerDocument: buyer.documentNumber,
      technicalKey: resolution?.technicalKey ?? appConfig.DIAN_TECHNICAL_KEY,
      environment: appConfig.DIAN_ENVIRONMENT,
    });
    const lines = [
      ...order.items.map((item) => ({ description: `${item.productName} (${item.variantName})`, quantity: item.quantity, unitPriceCents: item.unitPriceCents, totalCents: item.totalCents })),
      ...(order.shippingCents > 0 ? [{ description: "Envío", quantity: 1, unitPriceCents: order.shippingCents, totalCents: order.shippingCents }] : []),
      ...(order.discountCents > 0 ? [{ description: "Descuento", quantity: 1, unitPriceCents: -order.discountCents, totalCents: -order.discountCents }] : []),
    ];
    const xml = buildUblInvoice({
      number,
      cufe,
      issuedAt,
      currency: order.currency,
      seller: { nit: appConfig.DIAN_SELLER_NIT, name: SELLER_NAME },
      buyer,
      lines,
      subtotalCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
    });

    const invoice = await this.repository.create({
      number,
      orderId,
      userId: order.userId,
      status: "ISSUED",
      cufe,
      buyer,
      currency: order.currency,
      subtotalCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      xml,
      pdfUrl: null,
      issuedAt,
      resolutionId: resolution?.id ?? null,
    });

    // Envío a la DIAN (sandbox en habilitación). El resultado actualiza el estado de la factura
    const result = await this.dian.submit({ number, cufe, xml });
    const updated = await this.repository.update(invoice.id, {
      status: result.accepted ? "ACCEPTED" : "REJECTED",
      dianResponse: result.response as object,
      pdfUrl: `${appConfig.API_BASE_URL}/api/v1/invoice/${invoice.id}/pdf`,
    });
    commerceEvents.emit("invoice.issued", { userId: order.userId, invoiceId: invoice.id, number, orderId });
    // RF-11.2 envío por correo con el PDF y el XML (no bloquea ni revierte la emisión si el correo falla)
    await this.sendByEmail(invoice.id).catch((error: unknown) => logger.warn("invoice_email_failed", { invoiceId: invoice.id, error }));
    return updated;
  }

  // sendByEmail => RF-11.2 factura al correo del comprador: representación gráfica (PDF) + XML UBL adjuntos
  public async sendByEmail(id: string, viewer: Viewer = SYSTEM_VIEWER): Promise<{ emailedAt: Date }> {
    const invoice = await this.getInvoiceById(id, viewer);
    const { pdf } = await this.renderPdf(id, viewer);
    const user = await prisma.user.findUnique({ where: { id: invoice.userId }, select: { locale: true } });
    const locale = isLocale(user?.locale) ? user.locale : DEFAULT_LOCALE; // Idioma preferido del comprador
    const text = MESSAGES[locale].notifications.invoiceIssued({ number: invoice.number }); // Mismo texto que la notificación (DRY)
    await emailService.send(invoice.buyer.email, {
      ...EmailTemplates.notification(locale, { title: text.title, body: text.body }),
      attachments: [
        { filename: `factura-${invoice.number}.pdf`, content: pdf, contentType: "application/pdf" },
        ...(invoice.xml ? [{ filename: `factura-${invoice.number}.xml`, content: Buffer.from(invoice.xml, "utf8"), contentType: "application/xml" }] : []),
      ],
    });
    const emailedAt = new Date();
    await this.repository.update(id, { emailedAt });
    return { emailedAt };
  }

  // voidInvoice => RF-11.3 anulación: nota crédito por el saldo no acreditado y estado VOIDED (la factura no se borra)
  public async voidInvoice(id: string, reason: string): Promise<InvoiceDetailDto> {
    const invoice = await this.repository.findById(id);
    if (!invoice) throw new InvoiceNotFoundException(id);
    if (invoice.status === "VOIDED") throw new ConflictException("La factura ya está anulada", "INVOICE_ALREADY_VOIDED");
    const remaining = invoice.totalCents - invoice.creditNotes.reduce((sum, note) => sum + note.amountCents, 0);
    if (remaining > 0) await this.createCreditNote(id, { amountCents: remaining, reason: `Anulación: ${reason}` });
    return this.repository.update(id, { status: "VOIDED", voidedAt: new Date() });
  }

  // --- RF-11.3 resoluciones DIAN ---
  public async listResolutions() {
    const today = new Date();
    // Cada resolución con sus alertas: rango casi agotado o vigencia por vencer (el ADMIN pide una nueva a tiempo)
    return (await this.repository.listResolutions()).map((resolution) => {
      const remaining = resolution.toNumber - resolution.nextNumber + 1;
      const total = resolution.toNumber - resolution.fromNumber + 1;
      const daysLeft = Math.ceil((resolution.validTo.getTime() - today.getTime()) / 86_400_000);
      return { ...resolution, remaining, daysLeft, alerts: [...(remaining / total < RESOLUTION_ALERT_RATIO ? ["RANGE_LOW"] : []), ...(daysLeft < RESOLUTION_ALERT_DAYS ? ["EXPIRING"] : [])] };
    });
  }

  public createResolution(input: ResolutionInput) {
    return this.repository.createResolution({ ...input, nextNumber: input.fromNumber });
  }

  public updateResolution(id: string, isActive: boolean) {
    return this.repository.updateResolution(id, { isActive });
  }

  // taxReport => RF-11.3 reporte tributario (JSON para el panel o CSV para el contador)
  public async taxReport(from: Date, to: Date): Promise<{ rows: Awaited<ReturnType<InvoiceRepository["taxReport"]>>; totals: Record<string, number> }> {
    const rows = await this.repository.taxReport(from, to);
    const sum = (key: "invoices" | "subtotalCents" | "taxCents" | "totalCents" | "creditNotesCents") => rows.reduce((total, row) => total + row[key], 0);
    const totals = { invoices: sum("invoices"), subtotalCents: sum("subtotalCents"), taxCents: sum("taxCents"), totalCents: sum("totalCents"), creditNotesCents: sum("creditNotesCents") };
    return { rows, totals: { ...totals, netCents: totals.totalCents - totals.creditNotesCents } };
  }

  public async taxReportCsv(from: Date, to: Date): Promise<Buffer> {
    const { rows } = await this.taxReport(from, to);
    const money = (cents: number) => (cents / 100).toFixed(2);
    return toCsv(
      ["mes", "facturas", "base_gravable", "iva", "total", "notas_credito", "neto"],
      rows.map((row) => ({ mes: row.month, facturas: row.invoices, base_gravable: money(row.subtotalCents), iva: money(row.taxCents), total: money(row.totalCents), notas_credito: money(row.creditNotesCents), neto: money(row.totalCents - row.creditNotesCents) }))
    );
  }

  // listInvoices => "listar facturas con filtros de fecha" (el cliente ve las suyas)
  public async listInvoices(query: PaginationQuery & { from?: Date | undefined; to?: Date | undefined }, viewer: Viewer): Promise<{ items: InvoiceSummaryDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(isAdmin(viewer) ? undefined : viewer.id, query, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getInvoiceById => "factura con datos fiscales y XML DIAN"
  public async getInvoiceById(id: string, viewer: Viewer): Promise<InvoiceDetailDto> {
    const invoice = await this.repository.findById(id);
    if (!invoice || (invoice.userId !== viewer.id && !isAdmin(viewer))) throw new InvoiceNotFoundException(id);
    return invoice;
  }

  // renderPdf => representación gráfica de la factura (obligatoria para el cliente)
  public async renderPdf(id: string, viewer: Viewer): Promise<{ number: string; pdf: Buffer }> {
    const invoice = await this.getInvoiceById(id, viewer);
    const items = await prisma.orderItem.findMany({ where: { orderId: invoice.orderId } });
    const pdf = await renderInvoicePdf({
      number: invoice.number,
      cufe: invoice.cufe,
      issuedAt: invoice.issuedAt ?? new Date(),
      seller: { name: SELLER_NAME, nit: appConfig.DIAN_SELLER_NIT },
      buyer: invoice.buyer,
      items: items.map((item) => ({ description: `${item.productName} (${item.variantName})`, quantity: item.quantity, unitPriceCents: item.unitPriceCents, totalCents: item.totalCents })),
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      totalCents: invoice.totalCents,
      currency: invoice.currency,
    });
    return { number: invoice.number, pdf };
  }

  // createCreditNote => "nota crédito DIAN — documento inmutable vinculado a factura"
  public async createCreditNote(invoiceId: string, input: { amountCents: number; reason: string; refundId?: string | undefined }): Promise<InvoiceDetailDto> {
    const invoice = await this.repository.findById(invoiceId);
    if (!invoice) throw new InvoiceNotFoundException(invoiceId);
    const credited = invoice.creditNotes.reduce((sum, note) => sum + note.amountCents, 0);
    if (input.amountCents > invoice.totalCents - credited) throw new CreditNoteExceedsInvoiceException(invoice.totalCents - credited);

    const number = `NC${await this.repository.nextCreditNoteNumber()}`;
    // CUDE => mismo principio que el CUFE (SHA-384) aplicado a la nota crédito
    const cude = sha384(`${number}${new Date().toISOString()}${input.amountCents}${invoice.cufe ?? ""}${appConfig.DIAN_SELLER_NIT}`);
    await this.repository.createCreditNote({
      number,
      invoiceId,
      refundId: input.refundId ?? null,
      reason: input.reason,
      amountCents: input.amountCents,
      cude,
    });
    return (await this.repository.findById(invoiceId)) as InvoiceDetailDto;
  }

  // registerSubscribers => factura automática al colocar el pedido; nota crédito automática al procesar un reembolso
  public registerSubscribers(): void {
    commerceEvents.on("order.placed", async (event) => {
      if (event.totalCents <= 0) return; // Pedido de reposición por cambio (RF-12.4): sin valor, no se factura
      await this.createInvoice(event.orderId);
    });
    commerceEvents.on("refund.updated", async (event) => {
      if (event.status !== "PROCESSED" || event.amountCents <= 0) return; // Un cambio no mueve dinero: sin nota crédito
      const invoice = await this.repository.findByOrder(event.orderId);
      if (!invoice) return;
      await this.createCreditNote(invoice.id, { amountCents: event.amountCents, reason: "Devolución procesada", refundId: event.refundId });
    });
  }
}

export const invoiceService = new InvoiceService(invoiceRepository, new SandboxDianGateway());
