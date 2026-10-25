// checkout.dto.ts => contrato de salida de la sesión de checkout (lo consume el CheckoutStepper de Next.js).
import type { CheckoutStatus } from "@prisma/client";
import type { CheckoutItemSnapshot, ShippingAddressSnapshot } from "../schema/checkout.schema";
import type { ShippingRateDto } from "../../shipping/dto/shipping.dto";

export interface CheckoutSessionDto {
  id: string;
  status: CheckoutStatus;
  currency: string;
  items: CheckoutItemSnapshot[];
  addressId: string | null;
  shippingAddress: ShippingAddressSnapshot | null;
  shippingRateCode: string | null;
  couponCode: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  expiresAt: Date;
  orderId: string | null; // Presente cuando el pago se confirmó y el pedido ya existe
  pointsRedeemed: number; // RF-07.3/08.7 puntos canjeados en esta compra
  pointsDiscountCents: number; // Valor de esos puntos (ya incluido en discountCents)
  promotions: Array<{ promotionId: string; name: string; discountCents: number }>; // RF-13.10 promociones aplicadas
  channel: string; // RF-09.7 canal de origen
  // Tarifas disponibles para el destino elegido (el paso de envío muestra las opciones)
  shippingRates?: ShippingRateDto[] | undefined;
}
