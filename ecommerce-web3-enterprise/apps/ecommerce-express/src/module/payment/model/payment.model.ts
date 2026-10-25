// payment.model.ts => reglas de dominio del pago (funciones puras).
import type { PaymentStatus } from "@prisma/client";

// isVoidable => "anular pago en estado pendiente" (aún no capturado por Stripe)
export function isVoidable(status: PaymentStatus): boolean {
  return status === "PENDING" || status === "REQUIRES_ACTION";
}

// refundableCents => cuánto queda por devolver de un pago cobrado
export function refundableCents(payment: { status: PaymentStatus; amountCents: number; refundedCents: number }): number {
  if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") return 0;
  return Math.max(0, payment.amountCents - payment.refundedCents);
}
