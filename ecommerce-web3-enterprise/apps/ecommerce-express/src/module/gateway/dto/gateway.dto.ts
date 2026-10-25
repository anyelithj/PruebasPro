// gateway.dto.ts (Zod + TypeScript) => PaymentRequest, RetryRequest y PaymentResponse del proxy de pagos.
// Patrón DTO: el schema valida en runtime y "z.infer" deriva el tipo (DRY). La Idempotency-Key llega por HEADER.
import { z } from "zod";
import type { CircuitState } from "../guard/circuit_breaker.guard";
import type { GatewayTxStatus } from "../model/gateway.model";

// IdempotencyKeySchema => header "Idempotency-Key" obligatorio (UUID u otro identificador de 8 a 100 caracteres)
export const IdempotencyKeySchema = z.string({ required_error: "Header Idempotency-Key obligatorio" }).regex(/^[A-Za-z0-9_-]{8,100}$/, { message: "Idempotency-Key inválida (8-100: letras, dígitos, _ y -)" });

// PaymentRequest => POST /api/v1/rt/gateway/payment/process — reutiliza la sesión de checkout del módulo payment
export const PaymentRequestSchema = z.object({ checkout_session_id: z.string().uuid(), idempotencyKey: IdempotencyKeySchema });
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

// RetryRequest => POST /api/v1/rt/gateway/payment/:id/retry (solo el header; el cuerpo va vacío)
export const RetryRequestSchema = z.object({ idempotencyKey: IdempotencyKeySchema });
export type RetryRequest = z.infer<typeof RetryRequestSchema>;

// PaymentResponse => estado de la transacción en el gateway + estado del pago + estado del circuito
export interface PaymentResponse {
  readonly id: string;
  readonly provider: string;
  readonly status: GatewayTxStatus;
  readonly paymentId: string | null;
  readonly paymentStatus: string | null; // Estado en la tabla payments (lo confirma el webhook de Stripe)
  readonly attempts: number;
  readonly lastError: string | null;
  readonly circuit: CircuitState;
  readonly createdAt: Date;
  // Solo en process/retry: Stripe Elements lo necesita para confirmar el pago. NUNCA se guarda en la base
  readonly clientSecret?: string;
  readonly amountCents?: number;
  readonly currency?: string;
}
