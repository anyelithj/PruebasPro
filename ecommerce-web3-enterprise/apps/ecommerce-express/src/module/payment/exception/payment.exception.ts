// payment.exception.ts => errores de dominio del módulo Payment.
import type { PaymentStatus } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class PaymentNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Payment", id);
  }
}

// "anular pago en estado pendiente": un pago cobrado no se anula, se reembolsa
export class PaymentNotVoidableException extends ConflictException {
  constructor(status: PaymentStatus) {
    super(`Solo se anulan pagos pendientes (estado actual: ${status})`, "PAYMENT_NOT_VOIDABLE");
  }
}

// Firma de Stripe inválida => la petición no viene de Stripe (o el body fue alterado)
export class InvalidWebhookSignatureException extends BadRequestException {
  constructor() {
    super("Firma de webhook inválida", "INVALID_WEBHOOK_SIGNATURE");
  }
}

export class RefundExceedsPaymentException extends ConflictException {
  constructor(remainingCents: number) {
    super(`El reembolso supera el saldo reembolsable (${remainingCents})`, "REFUND_EXCEEDS_PAYMENT", { remainingCents });
  }
}
