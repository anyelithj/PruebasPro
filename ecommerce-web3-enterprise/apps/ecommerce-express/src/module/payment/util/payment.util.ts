// payment.util.ts => traducción de estados de Stripe al dominio propio (patrón Adapter, funciones puras).
// El resto del sistema nunca depende de los strings de Stripe: si se cambia de PSP, solo cambia este mapeo.
import type { PaymentStatus } from "@prisma/client";
import type Stripe from "stripe";

// mapIntentStatus => estado del PaymentIntent de Stripe -> PaymentStatus del dominio
export function mapIntentStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
  // "switch" exhaustivo sobre una unión de literales: TS avisa si Stripe agrega un estado nuevo sin mapear
  switch (status) {
    case "succeeded":
      return "SUCCEEDED";
    case "requires_action":
    case "requires_confirmation":
      return "REQUIRES_ACTION";
    case "canceled":
      return "CANCELLED";
    case "processing":
    case "requires_capture":
    case "requires_payment_method":
      return "PENDING";
    default:
      return "PENDING";
  }
}

// refundedStatus => estado del pago según cuánto se ha devuelto
export function refundedStatus(amountCents: number, refundedCents: number): PaymentStatus {
  if (refundedCents <= 0) return "SUCCEEDED";
  return refundedCents >= amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

// Stripe espera la moneda en minúsculas ISO 4217 ("cop")
export const stripeCurrency = (currency: string): string => currency.toLowerCase();
