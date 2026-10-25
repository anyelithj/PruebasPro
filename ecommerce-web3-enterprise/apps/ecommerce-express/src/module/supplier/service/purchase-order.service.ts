// purchase-order.service.ts => compras a proveedores:
//  - RF-23.6 crear, editar (borrador), enviar, recibir con control de calidad (lo aceptado entra al inventario) y anular
//  - RF-23.9 envío automático de la orden por correo (PDF adjunto) y WhatsApp (resumen)
//  - RF-23.5 ranking de proveedores · RF-23.8 cuentas por pagar con alertas de vencimiento y comparación de precios
//  - RF-23.3 valorización del inventario (costo promedio ponderado o FIFO) con las capas de costo de cada recepción
// Patrones: Facade + State (transiciones condicionadas) + Strategy (método de valoración) + Observer (aviso a admins).
import type { Prisma } from "@prisma/client";
import { purchaseOrderRepository, type PurchaseOrderRepository, type PurchaseOrderRow } from "../repository/purchase-order.repository";
import { averageValuation, canTransition, DUE_SOON_DAYS, fifoValuation, payableState, poNumber, supplierScore } from "../model/procurement.model";
import type { ListPurchaseOrdersQuery, PurchaseOrderInput, ReceiveInput, UpdatePurchaseOrderInput } from "../schema/purchase-order.schema";
import { supplierRepository } from "../repository/supplier.repository";
import { SupplierNotFoundException } from "../exception/supplier.exception";
import { inventoryService } from "../../inventory/service/inventory.service";
import { emailService } from "../../email/service/email.service";
import { renderPurchaseOrderPdf } from "../../invoice/util/pdf.util";
import { SELLER_NAME } from "../../invoice/service/invoice.service";
import { whatsappProvider } from "../../notification/provider/whatsapp.provider";
import { notificationService } from "../../notification/service/notification.service";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { Roles } from "../../../shared/constants/roles.constants";
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";

const DAY_MS = 86_400_000;
const money = (cents: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(cents / 100);

// toDto => fila -> respuesta con estado de la cuenta por pagar calculado (no se guarda: depende de la fecha)
const toDto = (row: PurchaseOrderRow) => ({ ...row, payable: payableState(row.dueAt, row.paidAt) });

export class PurchaseOrderService {
  constructor(private readonly repository: PurchaseOrderRepository) {}

  // resolveItems => SKU -> variantId en UNA consulta; SKU inexistente => 422 con el SKU
  private async resolveItems(items: PurchaseOrderInput["items"]) {
    const skus = items.filter((item) => !item.variantId && item.sku).map((item) => item.sku!);
    const variants = skus.length ? await prisma.productVariant.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } }) : [];
    const bySku = new Map(variants.map((variant) => [variant.sku, variant.id]));
    return items.map((item) => {
      const variantId = item.variantId ?? bySku.get(item.sku ?? "");
      if (!variantId) throw new UnprocessableException(`No existe el SKU ${item.sku}`, "VARIANT_NOT_FOUND");
      return { variantId, quantity: item.quantity, unitCostCents: item.unitCostCents };
    });
  }

  public async create(input: PurchaseOrderInput, userId: string) {
    const supplier = await supplierRepository.findById(input.supplierId);
    if (!supplier || !supplier.isActive) throw new SupplierNotFoundException(input.supplierId);
    const row = await this.repository.create(
      { supplierId: supplier.id, currency: supplier.currency, expectedAt: input.expectedAt ?? new Date(Date.now() + supplier.leadTimeDays * DAY_MS), notes: input.notes ?? null, createdById: userId, items: await this.resolveItems(input.items) },
      (sequence) => poNumber(new Date().getFullYear(), sequence)
    );
    return input.send ? this.send(row.id, ["EMAIL", "WHATSAPP"]) : toDto(row);
  }

  public async list(query: ListPurchaseOrdersQuery): Promise<{ items: ReturnType<typeof toDto>[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const now = new Date();
    // Filtro de cuentas por pagar (RF-23.8): abiertas, por vencer, vencidas o pagadas
    const PAYABLE: Record<NonNullable<ListPurchaseOrdersQuery["payable"]>, Prisma.PurchaseOrderWhereInput> = {
      open: { paidAt: null, status: { in: ["PARTIAL", "RECEIVED"] } },
      due: { paidAt: null, dueAt: { gte: now, lte: new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS) } },
      overdue: { paidAt: null, dueAt: { lt: now } },
      paid: { paidAt: { not: null } },
    };
    const payable = query.payable ? PAYABLE[query.payable] : undefined;
    const { items, total } = await this.repository.findMany({ ...(query.supplierId ? { supplierId: query.supplierId } : {}), ...(query.status ? { status: query.status } : {}), ...(payable ?? {}) }, page);
    return { items: items.map(toDto), meta: buildPaginationMeta(page, total) };
  }

  public async get(id: string) {
    return toDto(await this.find(id));
  }

  public async update(id: string, input: UpdatePurchaseOrderInput) {
    const current = await this.find(id);
    if (current.status !== "DRAFT") throw new UnprocessableException("Solo se editan órdenes en borrador", "PO_NOT_EDITABLE");
    return toDto(await this.repository.update(id, { ...input, items: input.items ? await this.resolveItems(input.items) : undefined }));
  }

  // send => RF-23.9 PDF por correo + resumen por WhatsApp; la orden pasa a SENT aunque un canal falle (se informa)
  public async send(id: string, channels: Array<"EMAIL" | "WHATSAPP">) {
    const order = await this.find(id);
    if (order.status !== "DRAFT" && order.status !== "SENT") throw new UnprocessableException(`La orden está ${order.status}`, "PO_NOT_SENDABLE");
    const sentVia: string[] = [];
    if (channels.includes("EMAIL")) {
      const pdf = await renderPurchaseOrderPdf({
        number: order.number,
        createdAt: order.createdAt,
        expectedAt: order.expectedAt,
        buyer: { name: SELLER_NAME, nit: appConfig.DIAN_SELLER_NIT },
        supplier: { name: order.supplier.name, email: order.supplier.email },
        items: order.items.map((item) => ({ sku: item.variant.sku, description: `${item.variant.product.name} ${item.variant.name}`, quantity: item.quantity, unitCostCents: item.unitCostCents })),
        totalCents: order.totalCents,
        currency: order.currency,
        notes: order.notes,
      });
      const text = `Orden de compra ${order.number} por ${money(order.totalCents, order.currency)}. Entrega esperada: ${order.expectedAt?.toISOString().slice(0, 10) ?? "a convenir"}.`;
      await emailService
        .send(order.supplier.email, { subject: `Orden de compra ${order.number} · ${SELLER_NAME}`, html: `<p>${text}</p><p>Adjuntamos el detalle en PDF.</p>`, text, attachments: [{ filename: `${order.number}.pdf`, content: pdf, contentType: "application/pdf" }] })
        .then(() => sentVia.push("EMAIL"))
        .catch((error: unknown) => logger.warn("po_email_failed", { id, error: String(error) }));
    }
    if (channels.includes("WHATSAPP") && order.supplier.phone) {
      const lines = order.items.map((item) => `• ${item.variant.sku} x${item.quantity}`).join("\n");
      await whatsappProvider
        .send(order.supplier.phone, `${SELLER_NAME}: orden de compra ${order.number}\n${lines}\nTotal ${money(order.totalCents, order.currency)}. El PDF llegó a ${order.supplier.email}.`)
        .then(() => sentVia.push("WHATSAPP"))
        .catch((error: unknown) => logger.warn("po_whatsapp_failed", { id, error: String(error) }));
    }
    if (sentVia.length === 0) throw new UnprocessableException("No se pudo enviar por ningún canal", "PO_SEND_FAILED");
    await this.repository.setStatus(id, ["DRAFT", "SENT"], { status: "SENT", sentAt: new Date(), sentVia });
    return this.get(id);
  }

  // receive => RF-23.6 recepción con QC: lo aceptado entra al inventario (movimiento IN) y crea su capa de costo;
  // completa => RECEIVED y arranca el plazo de pago (dueAt = hoy + plazo del proveedor)
  public async receive(id: string, input: ReceiveInput, actorId: string) {
    const order = await this.find(id);
    if (!canTransition(order.status, "RECEIVED")) throw new UnprocessableException(`No se puede recibir una orden ${order.status}`, "PO_NOT_RECEIVABLE");
    const items = new Map(order.items.map((item) => [item.id, item]));
    for (const line of input.items) {
      const item = items.get(line.itemId);
      if (!item) throw new NotFoundException("PurchaseOrderItem", line.itemId);
      if (item.receivedQuantity + item.rejectedQuantity + line.accepted + line.rejected > item.quantity) throw new UnprocessableException(`Se recibe más de lo pedido en ${item.variant.sku}`, "PO_OVER_RECEIVED");
    }
    const updated = await this.repository.receive(id, input.items.map((line) => ({ ...line, qcNotes: line.qcNotes ?? null })));
    for (const line of input.items.filter((l) => l.accepted > 0)) {
      const item = items.get(line.itemId)!;
      await inventoryService.move({ variantId: item.variantId, type: "IN", delta: line.accepted, quantity: line.accepted, reason: `Recepción ${order.number}`, reference: order.number, warehouse: input.warehouse }, actorId);
    }
    const complete = updated.items.every((item) => item.receivedQuantity + item.rejectedQuantity >= item.quantity);
    const now = new Date();
    await this.repository.setStatus(id, [order.status], { status: complete ? "RECEIVED" : "PARTIAL", receivedAt: now, ...(order.dueAt ? {} : { dueAt: new Date(now.getTime() + order.supplier.paymentTermsDays * DAY_MS) }) });
    return this.get(id);
  }

  public async cancel(id: string) {
    const order = await this.find(id);
    if (!(await this.repository.setStatus(id, ["DRAFT", "SENT"], { status: "CANCELLED" }))) throw new UnprocessableException(`No se puede anular una orden ${order.status}`, "PO_NOT_CANCELLABLE");
    return this.get(id);
  }

  // pay => RF-23.8 registra el pago (cierra la cuenta por pagar)
  public async pay(id: string) {
    const order = await this.find(id);
    if (order.paidAt) return toDto(order);
    await this.repository.setStatus(id, ["PARTIAL", "RECEIVED"], { paidAt: new Date() });
    return this.get(id);
  }

  // dueAlerts => job diario: avisa a los administradores de pagos por vencer o vencidos (máx. un aviso por día)
  public async dueAlerts(): Promise<number> {
    const now = new Date();
    const due = await this.repository.dueSoon(new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS), new Date(now.getTime() - DAY_MS));
    if (due.length === 0) return 0;
    const admins = await prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { name: Roles.ADMIN } } } }, select: { id: true } });
    for (const order of due) {
      const overdue = (order.dueAt?.getTime() ?? 0) < now.getTime();
      await notificationService.broadcast(admins.map((admin) => admin.id), {
        type: "SYSTEM",
        message: { title: `${overdue ? "Pago vencido" : "Pago por vencer"}: ${order.number}`, body: `${order.supplier.name} · ${money(order.totalCents, order.currency)} · vence ${order.dueAt?.toISOString().slice(0, 10)}` },
        url: "/dashboard/inventory?tab=purchases",
        channels: ["IN_APP", "EMAIL"],
      });
      await this.repository.setStatus(order.id, [order.status], { dueAlertAt: now });
    }
    return due.length;
  }

  // ranking => RF-23.5 proveedores ordenados por puntaje (puntualidad, calidad, evaluación y precio)
  public async ranking() {
    const stats = await this.repository.supplierStats();
    return stats
      .map((row) => ({ ...row, onTimeRate: row.orders ? row.onTime / row.orders : null, qualityRate: row.received + row.rejected ? row.received / (row.received + row.rejected) : null, score: supplierScore(row) }))
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ position: index + 1, ...row }));
  }

  public priceComparison(filter: { variantId?: string | undefined; q?: string | undefined }) {
    return this.repository.priceComparison(filter);
  }

  // valuation => RF-23.3 valor del inventario por variante y total (costo promedio o FIFO)
  public async valuation(method: "AVERAGE" | "FIFO", limit: number) {
    const rows = await this.repository.valuationRows(limit);
    const strategy = method === "FIFO" ? fifoValuation : averageValuation;
    const items = rows.map((row) => ({ variantId: row.id, sku: row.sku, name: `${row.product.name} ${row.name}`.trim(), stock: row.stock, ...strategy(row.costLayers, row.stock) }));
    return { method, totalCents: items.reduce((sum, item) => sum + item.valueCents, 0), unvaluedUnits: items.reduce((sum, item) => sum + item.unvaluedUnits, 0), items };
  }

  private async find(id: string): Promise<PurchaseOrderRow> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException("PurchaseOrder", id);
    return row;
  }
}

export const purchaseOrderService = new PurchaseOrderService(purchaseOrderRepository);
