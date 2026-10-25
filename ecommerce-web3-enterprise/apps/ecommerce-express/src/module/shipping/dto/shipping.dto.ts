// shipping.dto.ts => contratos de salida del módulo Shipping.
import type { ShipmentStatus } from "@prisma/client";
import type { RateQuote } from "../model/shipping.model";

export interface ShippingRateDto extends RateQuote {
  currency: string;
}

export interface ShipmentEventDto {
  status: ShipmentStatus;
  description: string;
  location: string | null;
  occurredAt: Date;
}

export interface ShipmentDto {
  id: string;
  orderId: string;
  orderNumber: string;
  status: ShipmentStatus;
  rateCode: string;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  labelUrl: string | null;
  costCents: number;
  estimatedDelivery: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  events: ShipmentEventDto[]; // Timeline de rastreo (OrderTracking en el frontend)
  delayed: boolean; // RF-09.6 la fecha estimada ya pasó y aún no se entrega
}

// ShipmentTrackingDto => RF-09.1/09.3/10.5 mapa (paquete y destino) + contacto con la transportadora
export interface ShipmentTrackingDto {
  package: { latitude: number; longitude: number; label: string } | null; // Ciudad del último evento con ubicación
  destination: { latitude: number; longitude: number; label: string } | null;
  carrier: { name: string; phone: string | null; trackingUrl: string | null } | null;
}

// CarrierStatsDto => RF-10.7 desempeño por transportadora en el período
export interface CarrierStatsDto {
  carrier: string; // Código ("SERVIENTREGA")
  shipments: number;
  delivered: number;
  onTimeRate: number; // Entregados a tiempo / entregados (0-1)
  avgDeliveryDays: number | null; // Promedio despacho -> entrega
  returned: number;
  cancelled: number;
  delayedOpen: number; // En curso con la fecha estimada vencida
  costCents: number; // Costo total de envíos cobrados
}
