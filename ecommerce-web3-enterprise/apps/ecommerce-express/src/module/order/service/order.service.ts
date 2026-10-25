// order.service.ts => casos de uso del pedido: colocar (desde checkout pagado), listar, detalle, estados, cancelar.
import type { OrderStatus, ShipmentStatus } from "@prisma/client";
import { orderRepository, type OrderRepository, type OrderScope } from "../repository/order.repository";
import { canBeCancelled, canTransitionOrder, CUSTOMER_CANCEL_WINDOW_HOURS, DELIVERY_CHANGE_STATUSES } from "../model/order.model";
import { cartService } from "../../cart/service/cart.service"; // RF-09.4 volver a pedir
import { commerceEvents, type OrderEventPayload } from "../event/order.event";
import {
  InvalidOrderTransitionException,
  OrderNotCancellableException,
  OrderNotFoundException,
  PaymentNotConfirmedException,
} from "../exception/order.exception";
import type { OrderDetailDto, OrderSummaryDto, ReorderResultDto } from "../dto/order.dto";
import type { ListOrdersQuery, ManualOrderInput, UpdateDeliveryInput } from "../schema/order.schema";
import { computeTotals } from "../../checkout/model/checkout.model";
import type { CheckoutItemSnapshot } from "../../checkout/schema/checkout.schema";
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { Roles } from "../../../shared/constants/roles.constants";

// Viewer => quien ejecuta la acción ("system" = webhook/job interno sin usuario)
export interface OrderViewer {
  id: string;
  roles: string[];
}

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  // placeOrder => "crear orden desde checkout confirmado" (idempotente; la invoca el webhook de pago o el cliente)
  public async placeOrder(checkoutSessionId: string, viewer?: OrderViewer): Promise<OrderDetailDto> {
    const result = await this.repository.placeFromCheckout(checkoutSessionId);
    if (!result) throw new PaymentNotConfirmedException();

    const order = await this.repository.findDetail(result.orderId);
    if (!order) throw new OrderNotFoundException(result.orderId);
    if (viewer && !this.canView(order, viewer)) throw new OrderNotFoundException(result.orderId); // No revela pedidos ajenos

    // Solo la PRIMERA colocación publica el evento (la llamada idempotente repetida no duplica efectos)
    if (result.created) commerceEvents.emit("order.placed", toPayload(order));
    return order;
  }

  // createManualOrder => "el ADMIN crea un pedido" (venta asistida o pruebas): precios VIGENTES del catálogo, IVA de
  // la configuración y el mismo evento "order.placed" del checkout (envío, correo, CRM y webhooks reaccionan igual).
  public async createManualOrder(input: ManualOrderInput, viewer: OrderViewer): Promise<OrderDetailDto> {
    const customer = await prisma.user.findUnique({ where: { email: input.customerEmail }, select: { id: true } });
    if (!customer) throw new NotFoundException("User", input.customerEmail);

    // Una sola consulta para todas las variantes (sin N+1); "include" trae el nombre del producto y su primera imagen
    const variants = await prisma.productVariant.findMany({
      where: { sku: { in: input.items.map((item) => item.sku) }, isActive: true },
      include: { product: { select: { name: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } } },
    });
    const bySku = new Map(variants.map((variant) => [variant.sku, variant]));
    const missing = input.items.find((item) => !bySku.has(item.sku));
    if (missing) throw new UnprocessableException(`No existe una variante activa con SKU ${missing.sku}`, "VARIANT_NOT_FOUND", { sku: missing.sku });

    // "!" (non-null assertion de TypeScript) => seguro: "missing" ya garantizó que todas las SKU están en el mapa
    const items: CheckoutItemSnapshot[] = input.items.map(({ sku, quantity }) => {
      const variant = bySku.get(sku)!;
      return { variantId: variant.id, productId: variant.productId, productName: variant.product.name, variantName: variant.name, sku, imageUrl: variant.product.images[0]?.url ?? null, unitPriceCents: variant.priceCents, quantity, weightGrams: variant.weightGrams };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const orderId = await this.repository.createManual({
      userId: customer.id,
      items,
      totals: computeTotals({ subtotalCents, discountCents: 0, shippingCents: input.shippingCents, taxRate: appConfig.TAX_RATE }),
      currency: appConfig.DEFAULT_CURRENCY,
      shippingAddress: input.shippingAddress,
      note: input.note || "Pedido creado por el administrador",
      changedById: viewer.id,
    });
    const order = await this.getOrderById(orderId, viewer);
    commerceEvents.emit("order.placed", toPayload(order)); // Observer: mismos efectos que una compra en la tienda
    return order;
  }

  // listOrders => "listar órdenes con estado y fechas"
  public async listOrders(query: ListOrdersQuery, viewer: OrderViewer): Promise<{ items: OrderSummaryDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(this.scopeFor(viewer), query, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getOrderById => "orden completa con ítems, pagos y envío"
  public async getOrderById(id: string, viewer: OrderViewer): Promise<OrderDetailDto> {
    const order = await this.repository.findDetail(id);
    if (!order || !(await this.canViewAsync(order, viewer))) throw new OrderNotFoundException(id);
    return order;
  }

  // updateOrderStatus => "CONFIRMED→PREPARING→PACKED→SHIPPED→DELIVERED|CANCELLED" (staff)
  public async updateOrderStatus(id: string, to: OrderStatus, note: string | undefined, viewer: OrderViewer): Promise<OrderDetailDto> {
    // El permiso UPDATE:order ya lo exige la ruta (RBAC); aquí solo se valida visibilidad (VENDOR: pedidos con sus productos)
    const order = await this.getOrderById(id, viewer);
    if (to === "CANCELLED") return this.cancelOrder(id, note ?? "Cancelado por el staff", viewer);
    if (!canTransitionOrder(order.status, to)) throw new InvalidOrderTransitionException(order.status, to);

    await this.repository.changeStatus(id, order.status, to, note ?? null, viewer.id);
    commerceEvents.emit("order.status-changed", { ...toPayload(order), from: order.status, to });
    return this.getOrderById(id, viewer);
  }

  // cancelOrder => "cancelar orden antes del envío": repone stock y dispara el reembolso (suscriptor en Payment)
  public async cancelOrder(id: string, reason: string, viewer: OrderViewer): Promise<OrderDetailDto> {
    const order = await this.getOrderById(id, viewer);
    if (!canBeCancelled(order.status)) throw new OrderNotCancellableException(order.status);
    // RF-09.3 regla de tiempo: el cliente solo cancela en la ventana inicial; el staff (o el sistema) siempre puede
    const isCustomer = !viewer.roles.includes(Roles.ADMIN) && !viewer.roles.includes(Roles.VENDOR) && viewer.id !== "system";
    if (isCustomer && order.cancellableUntil && order.cancellableUntil < new Date()) {
      throw new UnprocessableException(`Solo puedes cancelar durante las primeras ${CUSTOMER_CANCEL_WINDOW_HOURS} horas; solicita una devolución o contacta a soporte`, "CANCEL_WINDOW_EXPIRED");
    }

    await this.repository.cancelAndRestock(id, order.status, reason, viewer.id);
    commerceEvents.emit("order.cancelled", { ...toPayload(order), reason });
    return this.getOrderById(id, viewer);
  }

  // updateDelivery => RF-09.3 el DUEÑO reprograma la entrega o deja instrucciones mientras el paquete no esté en reparto
  public async updateDelivery(id: string, input: UpdateDeliveryInput, viewer: OrderViewer): Promise<OrderDetailDto> {
    const order = await this.getOrderById(id, viewer);
    if (order.userId !== viewer.id) throw new OrderNotFoundException(id); // Solo el comprador (no revela pedidos ajenos)
    const shipmentLocked = order.shipment && ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"].includes(order.shipment.status);
    if (!DELIVERY_CHANGE_STATUSES.includes(order.status) || shipmentLocked) throw new UnprocessableException("El pedido ya está en reparto o finalizado: no se puede modificar la entrega", "DELIVERY_LOCKED");
    const parts = [
      input.preferredDeliveryDate ? `Entrega reprogramada por el cliente para el ${input.preferredDeliveryDate.toISOString().slice(0, 10)}` : null,
      input.deliveryInstructions ? `Instrucciones para el mensajero: ${input.deliveryInstructions}` : null,
    ].filter(Boolean);
    await this.repository.updateDelivery(id, input, parts.join(" · ") || "Preferencias de entrega actualizadas");
    return this.getOrderById(id, viewer);
  }

  // reorder => RF-09.4 "volver a pedir con un clic": agrega al carrito activo cada producto que aún se vende (con la
  // cantidad original o la disponible); informa los que no se pudieron agregar en lugar de fallar todo
  public async reorder(id: string, viewer: OrderViewer): Promise<ReorderResultDto> {
    const order = await this.getOrderById(id, viewer);
    if (order.userId !== viewer.id) throw new OrderNotFoundException(id);
    const result: ReorderResultDto = { added: 0, skipped: [] };
    for (const item of order.items) {
      if (!item.variantId) {
        result.skipped.push({ productName: item.productName, reason: "PRODUCT_REMOVED" });
        continue;
      }
      // Secuencial (no Promise.all): cada alta lee y escribe el mismo carrito
      await cartService
        .addItemToCart(viewer.id, { variantId: item.variantId, quantity: item.quantity })
        .then(() => (result.added += 1))
        .catch((error: unknown) => result.skipped.push({ productName: item.productName, reason: (error as { code?: string }).code ?? "UNAVAILABLE" }));
    }
    return result;
  }

  // syncFromShipment => el envío manda sobre SHIPPED/DELIVERED (lo invoca el módulo Shipping; sin usuario)
  public async syncFromShipment(orderId: string, shipmentStatus: ShipmentStatus): Promise<void> {
    const target: OrderStatus | null =
      shipmentStatus === "IN_TRANSIT" || shipmentStatus === "OUT_FOR_DELIVERY" ? "SHIPPED" : shipmentStatus === "DELIVERED" ? "DELIVERED" : null;
    if (!target) return;
    const order = await this.repository.findDetail(orderId);
    if (!order || order.status === target) return;

    // Avanza paso a paso hasta el objetivo (ej. CONFIRMED -> PREPARING -> PACKED -> SHIPPED) dejando bitácora
    const path: OrderStatus[] = ["CONFIRMED", "PREPARING", "PACKED", "SHIPPED", "DELIVERED"];
    let current = order.status;
    while (current !== target && canTransitionOrder(current, path[path.indexOf(current) + 1] as OrderStatus)) {
      const next = path[path.indexOf(current) + 1] as OrderStatus;
      await this.repository.changeStatus(orderId, current, next, "Actualizado por el estado del envío", null);
      commerceEvents.emit("order.status-changed", { ...toPayload(order), from: current, to: next });
      current = next;
    }
  }

  // scopeFor => ADMIN ve todo; VENDOR, pedidos con sus productos; CUSTOMER, solo los propios
  private scopeFor(viewer: OrderViewer): OrderScope {
    if (viewer.roles.includes(Roles.ADMIN)) return { all: true };
    if (viewer.roles.includes(Roles.VENDOR)) return { vendorId: viewer.id };
    return { userId: viewer.id };
  }

  private canView(order: OrderDetailDto, viewer: OrderViewer): boolean {
    return order.userId === viewer.id || viewer.roles.includes(Roles.ADMIN);
  }

  private async canViewAsync(order: OrderDetailDto, viewer: OrderViewer): Promise<boolean> {
    if (this.canView(order, viewer)) return true;
    return viewer.roles.includes(Roles.VENDOR) && this.repository.vendorOwnsAnyItem(order.id, viewer.id);
  }
}

// toPayload => proyección mínima de la orden para los eventos
export function toPayload(order: OrderDetailDto): OrderEventPayload {
  return { orderId: order.id, orderNumber: order.orderNumber, userId: order.userId, totalCents: order.totalCents, currency: order.currency, pointsRedeemed: order.pointsRedeemed };
}

export const orderService = new OrderService(orderRepository);
