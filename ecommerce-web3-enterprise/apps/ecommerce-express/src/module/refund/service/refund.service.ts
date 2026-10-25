// refund.service.ts => devoluciones (sprint 4.1): solicitud del cliente → revisión del staff → reembolso en Stripe
// (módulo Payment) → nota crédito (módulo Invoice, vía evento "refund.updated").
import { refundRepository, type RefundRepository } from "../repository/refund.repository";
import { canRequestRefund, isPending, needsPickup, nextBusinessDay, RETURN_WINDOW_DAYS } from "../model/refund.model";
import {
  RefundAmountExceededException,
  RefundNotAllowedException,
  RefundNotFoundException,
  RefundNotPendingException,
} from "../exception/refund.exception";
import type { RefundDto, RefundStatsDto } from "../dto/refund.dto";
import type { CreateRefundInput, InspectionInput } from "../schema/refund.schema";
import { CONFIG_SCHEMAS } from "../../cms/schema/cms.schema";
import { cmsService } from "../../cms/service/cms.service";
import { shippingService } from "../../shipping/service/shipping.service";
import { carrierForRate } from "../../shipping/model/shipping.model";
import { inventoryService } from "../../inventory/service/inventory.service";
import { notificationService } from "../../notification/service/notification.service";
import { createPersonalCoupon } from "../../coupon/service/coupon.service";
import { orderRepository } from "../../order/repository/order.repository";
import { computeTotals } from "../../checkout/model/checkout.model";
import { ShippingAddressSnapshotSchema } from "../../checkout/schema/checkout.schema";
import { renderShippingLabel } from "../../invoice/util/pdf.util";
import { appConfig } from "../../../config/app.config";
import { ConflictException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";
import type { Prisma } from "@prisma/client";

// STORE_WAREHOUSE => destino de las devoluciones (etiqueta PDF de la recolección)
const STORE_WAREHOUSE = { recipientName: "eCommerce Web3 · Devoluciones", phone: "+576010000000", line1: "Calle 100 # 10-20, Bodega 3", line2: null, city: "Bogotá", state: "Cundinamarca", postalCode: "110111", country: "CO" };
const PHOTO_EXEMPT = new Set(["NOT_RECEIVED"]); // Sin producto en mano no hay foto que exigir
import { paymentService } from "../../payment/service/payment.service";
import { commerceEvents } from "../../order/event/order.event";
import { prisma } from "../../../config/database.config";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { NotFoundException } from "../../../shared/filter/http-exception.filter";
import type { RefundStatus } from "@prisma/client";

interface Viewer {
  id: string;
  roles: string[];
}

export class RefundService {
  constructor(private readonly repository: RefundRepository) {}

  // createRefund => "crear solicitud con motivo y evidencia"
  public async createRefund(input: CreateRefundInput, userId: string): Promise<RefundDto> {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, userId }, // Ownership: solo pedidos propios
      select: { id: true, status: true, totalCents: true, shipment: { select: { deliveredAt: true } } },
    });
    if (!order) throw new NotFoundException("Order", input.orderId);
    // RF-12.6 ventana configurable y RF-12.7 fotos obligatorias según la política de la tienda
    const policy = await this.policy();
    if (!canRequestRefund({ status: order.status, deliveredAt: order.shipment?.deliveredAt ?? null }, new Date(), policy.windowDays)) throw new RefundNotAllowedException(policy.windowDays);
    if (policy.requirePhotos && !PHOTO_EXEMPT.has(input.reason) && input.evidenceUrls.length === 0) {
      throw new UnprocessableException("Adjunta al menos una foto del producto que devuelves", "RETURN_PHOTOS_REQUIRED");
    }
    // RF-12.4 cambio: la variante nueva debe ser del mismo producto devuelto y tener unidades
    if (input.resolution === "EXCHANGE") await this.assertExchangeVariant(order.id, input.exchangeVariantId);

    // No se puede pedir más de lo pagado menos lo ya solicitado/devuelto
    const available = order.totalCents - (await this.repository.committedCents(order.id));
    // Un cambio no mueve dinero (monto 0); reembolso y crédito en tienda sí
    const amountCents = input.resolution === "EXCHANGE" ? 0 : (input.amountCents ?? available);
    if (input.resolution !== "EXCHANGE" && (amountCents <= 0 || amountCents > available)) throw new RefundAmountExceededException(Math.max(0, available));

    const refund = await this.repository.create({
      orderId: order.id,
      userId,
      reason: input.reason,
      description: input.description,
      evidenceUrls: input.evidenceUrls,
      amountCents,
      resolution: input.resolution,
      exchangeVariantId: input.exchangeVariantId ?? null,
      ...(input.items ? { items: input.items as unknown as Prisma.InputJsonValue } : {}),
    });
    this.publish(refund);
    return refund;
  }

  // listRefunds => "listar devoluciones con estado del proceso"
  public async listRefunds(query: PaginationQuery & { status?: RefundStatus | undefined }, viewer: Viewer): Promise<{ items: RefundDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(isAdmin(viewer) ? undefined : viewer.id, query.status, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getRefundById => "detalle de solicitud de devolución por ID"
  public async getRefundById(id: string, viewer: Viewer): Promise<RefundDto> {
    const refund = await this.repository.findById(id);
    if (!refund || (refund.userId !== viewer.id && !isAdmin(viewer))) throw new RefundNotFoundException(id);
    return refund;
  }

  // updateRefund => "aprobar y activar reembolso — PATCH parcial estado" (staff)
  public async reviewRefund(id: string, approve: boolean, note: string | undefined, reviewerId: string): Promise<RefundDto> {
    const refund = await this.repository.findById(id);
    if (!refund) throw new RefundNotFoundException(id);
    if (!isPending(refund.status)) throw new RefundNotPendingException();

    const reviewed = await this.repository.update(id, { status: approve ? "APPROVED" : "REJECTED", reviewedById: reviewerId, reviewNote: note ?? null });
    this.publish(reviewed);
    if (!approve) return reviewed;
    // RF-12.8 recolección automática coordinada con la transportadora (si hay producto que devolver)
    if (needsPickup(refund.reason)) await this.schedulePickup(reviewed);
    // RF-12.4 resolución: reembolso (Stripe/medio original), crédito en tienda o cambio por otra variante
    if (refund.resolution === "REFUND") await paymentService.refundPayment(id); // Payment publica "refund.updated" PROCESSED
    if (refund.resolution === "STORE_CREDIT") await this.grantStoreCredit(reviewed);
    if (refund.resolution === "EXCHANGE") await this.createExchangeOrder(reviewed);
    return (await this.repository.findById(id)) as RefundDto;
  }

  // policy => RF-12.6 política de devoluciones del ADMIN (sin MongoDB o sin configurar => 30 días y fotos obligatorias)
  private async policy(): Promise<{ windowDays: number; requirePhotos: boolean }> {
    const configs = (await cmsService.getConfig(true).catch(() => [])) as Array<{ section: string; value: unknown }>;
    const parsed = CONFIG_SCHEMAS.returns.safeParse(configs.find((config) => config.section === "returns")?.value);
    return parsed.success ? parsed.data : { windowDays: RETURN_WINDOW_DAYS, requirePhotos: true };
  }

  private async assertExchangeVariant(orderId: string, variantId: string | undefined): Promise<void> {
    if (!variantId) throw new UnprocessableException("Elige la talla o el color por el que quieres cambiar", "EXCHANGE_VARIANT_REQUIRED");
    const [variant, items] = await Promise.all([
      prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true, isActive: true, stock: true, reservedStock: true } }),
      prisma.orderItem.findMany({ where: { orderId }, select: { productId: true } }),
    ]);
    if (!variant?.isActive || variant.stock - variant.reservedStock <= 0) throw new UnprocessableException("La variante elegida no tiene unidades disponibles", "EXCHANGE_OUT_OF_STOCK");
    if (!items.some((item) => item.productId === variant.productId)) throw new UnprocessableException("Solo puedes cambiar por otra talla o color del mismo producto", "EXCHANGE_DIFFERENT_PRODUCT");
  }

  // schedulePickup => RF-12.8 guía de devolución con la primera transportadora activa y recolección el siguiente día hábil
  private async schedulePickup(refund: RefundDto): Promise<void> {
    const settings = await shippingService.settings();
    const carrier = settings.carriers.find((entry) => entry.enabled) ?? settings.carriers[0];
    if (!carrier) return;
    const label = carrierForRate(`${carrier.code}_STANDARD`, settings)?.createLabel(`${carrier.code}_STANDARD`);
    if (!label) return;
    const pickupScheduledAt = nextBusinessDay(new Date());
    await this.repository.update(refund.id, { returnStatus: "PICKUP_SCHEDULED", returnCarrier: carrier.name, returnTrackingNumber: `R${label.trackingNumber}`, pickupScheduledAt });
    await notificationService.notify(refund.userId, {
      type: "REFUND",
      message: { key: "returnPickupScheduled", params: { orderNumber: refund.orderNumber, date: pickupScheduledAt.toISOString().slice(0, 10), trackingNumber: `R${label.trackingNumber}` } },
      url: `/account/orders/${refund.orderId}`,
    });
  }

  // grantStoreCredit => RF-12.4 cupón personal por el valor de la devolución (vigente 1 año)
  private async grantStoreCredit(refund: RefundDto): Promise<void> {
    const code = await createPersonalCoupon({ userId: refund.userId, origin: "STORE_CREDIT", type: "FIXED_AMOUNT", value: refund.amountCents, validDays: 365, description: `Crédito por la devolución del pedido ${refund.orderNumber}` });
    this.publish(await this.repository.update(refund.id, { status: "PROCESSED", processedAt: new Date(), storeCreditCode: code }));
    // Transaccional: llega aunque no acepte marketing
    await notificationService.notify(refund.userId, { type: "REFUND", message: { key: "couponGranted", params: { code, origin: "STORE_CREDIT" } }, url: "/products" });
  }

  // createExchangeOrder => RF-12.4 pedido de reposición con la nueva variante, sin costo (reusa la transacción del pedido manual)
  private async createExchangeOrder(refund: RefundDto): Promise<void> {
    const [variant, order] = await Promise.all([
      prisma.productVariant.findUniqueOrThrow({ where: { id: refund.exchangeVariantId as string }, include: { product: { select: { name: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } } }),
      prisma.order.findUniqueOrThrow({ where: { id: refund.orderId }, select: { shippingAddress: true, currency: true } }),
    ]);
    const returned = (await this.returnedItems(refund)).reduce((sum, item) => sum + item.quantity, 0) || 1;
    const exchangeOrderId = await orderRepository.createManual({
      userId: refund.userId,
      items: [{ variantId: variant.id, productId: variant.productId, productName: variant.product.name, variantName: variant.name, sku: variant.sku, imageUrl: variant.product.images[0]?.url ?? null, unitPriceCents: 0, quantity: returned, weightGrams: variant.weightGrams }],
      totals: computeTotals({ subtotalCents: 0, discountCents: 0, shippingCents: 0, taxRate: appConfig.TAX_RATE }),
      currency: order.currency,
      shippingAddress: ShippingAddressSnapshotSchema.parse(order.shippingAddress),
      note: `Cambio de la devolución del pedido ${refund.orderNumber}`,
      changedById: refund.userId,
    });
    this.publish(await this.repository.update(refund.id, { status: "PROCESSED", processedAt: new Date(), exchangeOrderId }));
    // El pedido de reposición sigue el flujo normal: envío (Shipping crea el shipment) y notificación al cliente
    const created = await prisma.order.findUniqueOrThrow({ where: { id: exchangeOrderId }, select: { orderNumber: true } });
    commerceEvents.emit("order.placed", { orderId: exchangeOrderId, orderNumber: created.orderNumber, userId: refund.userId, totalCents: 0, currency: order.currency });
  }

  // returnedItems => unidades de la devolución (las indicadas o todas las del pedido)
  private async returnedItems(refund: RefundDto): Promise<Array<{ variantId: string; quantity: number }>> {
    const row = await prisma.refund.findUnique({ where: { id: refund.id }, select: { items: true } });
    if (Array.isArray(row?.items)) return row.items as Array<{ variantId: string; quantity: number }>;
    const items = await prisma.orderItem.findMany({ where: { orderId: refund.orderId, variantId: { not: null } }, select: { variantId: true, quantity: true } });
    return items.map((item) => ({ variantId: item.variantId as string, quantity: item.quantity }));
  }

  // updateReturnStatus => RF-12.2 seguimiento de la logística inversa (staff)
  public async updateReturnStatus(id: string, status: "IN_TRANSIT" | "RECEIVED"): Promise<RefundDto> {
    const refund = await this.repository.findById(id);
    if (!refund) throw new RefundNotFoundException(id);
    if (!refund.returnStatus) throw new ConflictException("La devolución no tiene recolección agendada", "RETURN_NOT_SCHEDULED");
    return this.repository.update(id, { returnStatus: status, ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}) });
  }

  // inspect => RF-12.7 inspección de calidad al recibir; RF-12.5 si se aprueba, las unidades vuelven al inventario
  public async inspect(id: string, input: InspectionInput, inspectorId: string): Promise<RefundDto> {
    const refund = await this.repository.findById(id);
    if (!refund) throw new RefundNotFoundException(id);
    if (refund.returnStatus !== "RECEIVED") throw new ConflictException("Marca la devolución como recibida antes de inspeccionarla", "RETURN_NOT_RECEIVED");
    const inspection = { ...input, inspectedById: inspectorId, inspectedAt: new Date().toISOString() };
    const updated = await this.repository.update(id, { returnStatus: input.passed ? "INSPECTED_OK" : "INSPECTED_FAILED", inspection: inspection as unknown as Prisma.InputJsonValue });
    if (input.passed) await this.restock(refund);
    return updated;
  }

  // restock => movimiento RETURN por cada variante (historial en MongoDB); si el historial no está disponible, el
  // stock se repone igual con un UPDATE atómico (nunca se pierde el reabastecimiento)
  private async restock(refund: RefundDto): Promise<void> {
    for (const item of await this.returnedItems(refund)) {
      await inventoryService
        .move({ variantId: item.variantId, type: "RETURN", delta: item.quantity, quantity: item.quantity, reason: `Devolución ${refund.orderNumber}`, reference: refund.id }, null)
        .catch(async (error: unknown) => {
          logger.warn("restock_movement_log_failed", { refundId: refund.id, error });
          await prisma.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        });
    }
  }

  // label => RF-12.2 etiqueta de devolución en PDF (dueño o staff) para pegar en el paquete
  public async label(id: string, viewer: Viewer): Promise<Buffer> {
    const refund = await this.getRefundById(id, viewer);
    if (!refund.returnTrackingNumber) throw new ConflictException("La devolución aún no tiene guía de recolección", "RETURN_NOT_SCHEDULED");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: refund.orderId }, select: { shippingAddress: true } });
    const customer = ShippingAddressSnapshotSchema.parse(order.shippingAddress);
    return renderShippingLabel({
      trackingNumber: refund.returnTrackingNumber,
      carrier: refund.returnCarrier ?? "",
      service: "DEVOLUCIÓN",
      orderNumber: refund.orderNumber,
      sender: `${customer.recipientName} · ${customer.line1}, ${customer.city} · ${customer.phone}`,
      recipient: STORE_WAREHOUSE,
      weightGrams: 1_000,
    });
  }

  // stats => RF-12.9 estadísticas del panel: estados, razones más frecuentes, resoluciones, tasa y tiempo de resolución
  public async stats(days: number): Promise<RefundStatsDto> {
    const raw = await this.repository.stats(new Date(Date.now() - days * 86_400_000));
    const total = raw.byStatus.reduce((sum, row) => sum + row._count._all, 0);
    return {
      total,
      byStatus: Object.fromEntries(raw.byStatus.map((row) => [row.status, row._count._all])),
      byReason: raw.byReason.map((row) => ({ reason: row.reason, count: row._count._all })),
      byResolution: Object.fromEntries(raw.byResolution.map((row) => [row.resolution, row._count._all])),
      refundedCents: raw.refundedCents,
      returnRate: raw.delivered > 0 ? Number((total / raw.delivered).toFixed(4)) : 0,
      avgResolutionHours: raw.avgResolutionHours === null ? null : Number(Number(raw.avgResolutionHours).toFixed(1)),
    };
  }

  // deleteRefundById => "cancelar solicitud en estado pendiente" (el cliente dueño)
  public async cancelRefund(id: string, viewer: Viewer): Promise<void> {
    const refund = await this.getRefundById(id, viewer);
    if (!isPending(refund.status)) throw new RefundNotPendingException();
    this.publish(await this.repository.update(id, { status: "CANCELLED" }));
  }

  private publish(refund: RefundDto): void {
    commerceEvents.emit("refund.updated", {
      userId: refund.userId,
      refundId: refund.id,
      orderId: refund.orderId,
      status: refund.status,
      amountCents: refund.amountCents,
      currency: refund.currency,
    });
  }
}

export const refundService = new RefundService(refundRepository);
