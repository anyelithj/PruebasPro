// order.dto.ts => contratos de salida del módulo Order.
import type { OrderChannel, OrderStatus, PaymentStatus, RefundStatus } from "@prisma/client";
import type { ShipmentDto } from "../../shipping/dto/shipping.dto";

export interface OrderItemDto {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
}

// Dirección copiada al momento de comprar (snapshot inmutable)
export interface ShippingAddressDto {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalCents: number;
  itemCount: number;
  placedAt: Date;
  channel: OrderChannel; // RF-09.7 origen del pedido (WEB, SOCIAL, MARKETING, MANUAL)
}

// OrderDetailDto => "orden completa con ítems, pagos y envío"
export interface OrderDetailDto extends OrderSummaryDto {
  userId: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  shippingAddress: ShippingAddressDto;
  items: OrderItemDto[];
  statusHistory: Array<{ from: OrderStatus | null; to: OrderStatus; note: string | null; at: Date }>;
  payments: Array<{ id: string; provider: string; status: PaymentStatus; amountCents: number; refundedCents: number; createdAt: Date }>;
  channelRef: string | null; // RF-09.7 referencia del canal (publicación social, campaña)
  pointsRedeemed: number; // RF-08.7
  preferredDeliveryDate: Date | null; // RF-09.3 entrega reprogramada
  deliveryInstructions: string | null; // RF-09.3 instrucciones para el mensajero
  cancellableUntil: Date | null; // RF-09.3 hasta cuándo el cliente puede cancelar (regla de tiempo)
  shipment: ShipmentDto | null;
  invoice: { id: string; number: string } | null;
  // RF-12 devoluciones del pedido con resolución, logística inversa y crédito/cambio generado
  refunds: Array<{
    id: string;
    status: RefundStatus;
    amountCents: number;
    resolution: string;
    returnStatus: string | null;
    returnCarrier: string | null;
    returnTrackingNumber: string | null;
    pickupScheduledAt: Date | null;
    storeCreditCode: string | null;
    exchangeOrderId: string | null;
  }>;
  cancelledAt: Date | null;
}

// ReorderResultDto => RF-09.4 resultado de "volver a pedir": qué entró al carrito y qué no (agotado, despublicado)
export interface ReorderResultDto {
  added: number;
  skipped: Array<{ productName: string; reason: string }>;
}
