// order.types.ts (entities) => forma JSON de checkout, pedidos, envíos y pagos.

export type OrderStatus = "CONFIRMED" | "PREPARING" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type ShipmentStatus = "PENDING" | "LABEL_CREATED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";
export type CheckoutStatus = "OPEN" | "ADDRESS_SET" | "PAYMENT_PENDING" | "COMPLETED" | "ABANDONED" | "EXPIRED";

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CheckoutItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  weightGrams: number;
}

export interface ShippingRate {
  code: string;
  carrier: string;
  service: string;
  costCents: number;
  estimatedDays: number;
  currency: string;
  pickup?: boolean; // RF-08.2 recogida en tienda
  recommended?: boolean; // RF-10.2 transportadora óptima (se preselecciona)
}

export interface CheckoutSession {
  id: string;
  status: CheckoutStatus;
  currency: string;
  items: CheckoutItem[];
  addressId: string | null;
  shippingAddress: ShippingAddress | null;
  shippingRateCode: string | null;
  couponCode: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  expiresAt: string;
  orderId: string | null;
  shippingRates?: ShippingRate[];
  pointsRedeemed: number; // RF-08.7
  pointsDiscountCents: number;
  channel: string; // RF-09.7
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalCents: number;
  itemCount: number;
  placedAt: string;
  channel: OrderChannel; // RF-09.7 origen del pedido
}

export type OrderChannel = "WEB" | "SOCIAL" | "MARKETING" | "MANUAL";

export interface ShipmentEvent {
  status: ShipmentStatus;
  description: string;
  location: string | null;
  occurredAt: string;
}

export interface Shipment {
  id: string;
  status: ShipmentStatus;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: ShipmentEvent[];
  delayed: boolean; // RF-09.6 fecha estimada vencida sin entregar
}

// ShipmentTracking => RF-09.1/10.5 mapa + RF-09.3 contacto de la transportadora (GET /shipping/:id/tracking)
export interface GeoPoint {
  latitude: number;
  longitude: number;
  label: string;
}
export interface ShipmentTracking {
  package: GeoPoint | null;
  destination: GeoPoint | null;
  carrier: { name: string; phone: string | null; trackingUrl: string | null } | null;
}

export interface OrderDetail extends OrderSummary {
  userId: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  shippingAddress: ShippingAddress;
  items: Array<{ id: string; productId: string | null; productName: string; variantName: string; sku: string; imageUrl: string | null; unitPriceCents: number; quantity: number; totalCents: number }>;
  statusHistory: Array<{ from: OrderStatus | null; to: OrderStatus; note: string | null; at: string }>;
  payments: Array<{ id: string; provider: string; status: string; amountCents: number; refundedCents: number; createdAt: string }>;
  channelRef: string | null;
  pointsRedeemed: number;
  preferredDeliveryDate: string | null; // RF-09.3
  deliveryInstructions: string | null;
  cancellableUntil: string | null; // RF-09.3 regla de tiempo para cancelar
  shipment: Shipment | null;
  invoice: { id: string; number: string } | null;
  refunds: Array<{ id: string; status: string; amountCents: number; resolution: string; returnStatus: string | null; returnCarrier: string | null; returnTrackingNumber: string | null; pickupScheduledAt: string | null; storeCreditCode: string | null; exchangeOrderId: string | null }>;
  cancelledAt: string | null;
}

// Los textos de cada estado viven en messages/*.json -> order.status.<ESTADO> (i18n)
