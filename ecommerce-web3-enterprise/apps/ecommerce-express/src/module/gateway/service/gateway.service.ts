// gateway.service.ts (TypeScript + Prisma + Stripe vía módulo payment) => proxy de pagos resiliente (sprint 9.3).
// NO duplica la integración con Stripe: envuelve paymentService (PaymentIntent, anulación) con
//   Idempotency-Key (tabla gateway_transactions, UNIQUE) + Circuit Breaker + timeout + reintentos con backoff,
// y registra cada llamada (gateway_retry_attempts) para auditoría. La tarjeta nunca toca este servidor (Stripe Elements).
// Patrones: Proxy (misma operación, más resiliencia), Adapter (errores del PSP -> transitorio / de negocio),
// Strategy (RetryPolicy por proveedor) y Circuit Breaker.
import { performance } from "node:perf_hooks";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { paymentService, type PaymentService } from "../../payment/service/payment.service";
import type { PaymentIntentDto } from "../../payment/dto/payment.dto";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { BadGatewayException } from "../../../shared/filter/http-exception.filter";
import { CircuitBreaker } from "../guard/circuit_breaker.guard";
import { DEFAULT_RETRY_POLICY, withRetry, type RetryPolicy } from "../strategy/retry_policy.strategy";
import { errorText, RESUMABLE, type GatewayTransaction } from "../model/gateway.model";
import type { PaymentRequest, PaymentResponse, RetryRequest } from "../dto/gateway.dto";
import { GatewayError } from "../error/gateway.error";

interface Viewer {
  readonly id: string;
  readonly roles: string[];
}

// Configuración por pasarela (timeout configurable). El SDK de Stripe ya reintenta 2 veces errores de red,
// por eso el proxy agrega solo 1 reintento más (2 intentos): suficiente sin multiplicar llamadas.
export const stripeBreaker = new CircuitBreaker("stripe", { failureThreshold: 5, resetTimeoutMs: 30_000, timeoutMs: 8_000 });
const STRIPE_RETRY: RetryPolicy = { ...DEFAULT_RETRY_POLICY, maxAttempts: 2 };

// Errores del SDK de Stripe que indican un problema TRANSITORIO (red, 5xx, rate limit)
const TRANSIENT_STRIPE_ERRORS = new Set(["StripeConnectionError", "StripeAPIError", "StripeRateLimitError"]);

// isTransient => Adapter de errores: solo los transitorios se reintentan y abren el circuito.
// Un 4xx del negocio (checkout vencido, pago no anulable, Stripe sin configurar) se devuelve tal cual.
export function isTransient(error: unknown): boolean {
  if (error instanceof GatewayError) return error.code === "GATEWAY_TIMEOUT";
  if (error instanceof BadGatewayException) return true;
  return typeof error === "object" && error !== null && "type" in error && TRANSIENT_STRIPE_ERRORS.has(String(error.type));
}

export class GatewayService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly payments: PaymentService = paymentService,
    private readonly breaker: CircuitBreaker = stripeBreaker,
    private readonly policy: RetryPolicy = STRIPE_RETRY
  ) {}

  // process => POST /payment/process. La misma Idempotency-Key devuelve la misma transacción (y el mismo intento)
  public async process(input: PaymentRequest, viewer: Viewer): Promise<PaymentResponse> {
    const existing = await this.db.gatewayTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.userId !== viewer.id || existing.checkoutSessionId !== input.checkout_session_id) throw GatewayError.idempotencyConflict();
      // Repetición: si sigue abierta se vuelve a pedir el client_secret (payment reutiliza el PaymentIntent abierto)
      return RESUMABLE.has(existing.status) ? this.call(existing, viewer, null) : this.toResponse(existing);
    }
    const created = await this.db.gatewayTransaction
      .create({ data: { userId: viewer.id, checkoutSessionId: input.checkout_session_id, idempotencyKey: input.idempotencyKey } })
      .catch(async (error: unknown) => {
        // Dos peticiones simultáneas con la misma clave: la UNIQUE deja pasar una; la otra repite el flujo
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
        throw error;
      });
    return created ? this.call(created, viewer, input.idempotencyKey) : this.process(input, viewer);
  }

  // retry => POST /payment/:id/retry — nuevo intento sobre una transacción FAILED (idempotente por su propia clave)
  public async retry(id: string, input: RetryRequest, viewer: Viewer): Promise<PaymentResponse> {
    const transaction = await this.findOwned(id, viewer);
    const prior = await this.db.gatewayRetryAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) {
      if (prior.transactionId !== transaction.id) throw GatewayError.idempotencyConflict();
      return RESUMABLE.has(transaction.status) ? this.call(transaction, viewer, null) : this.toResponse(transaction);
    }
    if (transaction.status !== "FAILED") throw GatewayError.notRetryable(transaction.status);
    return this.call(transaction, viewer, input.idempotencyKey);
  }

  // getById => GET /payment/:id — estado en el gateway + estado del pago (sin llamar a Stripe: lo actualiza el webhook)
  public async getById(id: string, viewer: Viewer): Promise<PaymentResponse> {
    return this.toResponse(await this.findOwned(id, viewer), undefined, viewer);
  }

  // cancel => DELETE /payment/:id — anula la pre-autorización (PaymentIntent) a través del circuito
  public async cancel(id: string, viewer: Viewer): Promise<void> {
    const transaction = await this.findOwned(id, viewer);
    if (transaction.status === "CANCELLED") return; // Idempotente
    if (transaction.paymentId) {
      const paymentId = transaction.paymentId;
      await this.breaker.execute(() => this.payments.voidPayment(paymentId, viewer), isTransient);
    }
    await this.db.gatewayTransaction.update({ where: { id }, data: { status: "CANCELLED" } });
  }

  // call => PSP a través de reintentos + circuito; actualiza la transacción y (si recordKey) registra el intento
  private async call(transaction: GatewayTransaction, viewer: Viewer, recordKey: string | null): Promise<PaymentResponse> {
    const started = performance.now();
    let tries = 0;
    try {
      const { value: intent } = await withRetry(
        (attempt) => {
          tries = attempt;
          return this.breaker.execute(() => this.payments.processPayment(transaction.checkoutSessionId, viewer.id), isTransient);
        },
        isTransient,
        this.policy
      );
      const updated = await this.db.gatewayTransaction.update({
        where: { id: transaction.id },
        data: { status: "PENDING", paymentId: intent.paymentId, attempts: { increment: tries }, lastError: null },
      });
      if (recordKey) await this.record(transaction.id, "PENDING", null, started, recordKey);
      return this.toResponse(updated, intent);
    } catch (error) {
      const lastError = errorText(error);
      await this.db.gatewayTransaction.update({ where: { id: transaction.id }, data: { status: "FAILED", attempts: { increment: tries }, lastError } });
      if (recordKey) await this.record(transaction.id, "FAILED", lastError, started, recordKey);
      throw error; // El cliente recibe el error original (422 checkout inválido, 503 circuito abierto, 504 timeout...)
    }
  }

  private async record(transactionId: string, status: "PENDING" | "FAILED", error: string | null, started: number, idempotencyKey: string): Promise<void> {
    const attempt = (await this.db.gatewayRetryAttempt.count({ where: { transactionId } })) + 1;
    await this.db.gatewayRetryAttempt.create({ data: { transactionId, attempt, status, error, durationMs: Math.round(performance.now() - started), idempotencyKey } });
  }

  // findOwned => el cliente solo ve sus transacciones (404, no 403: no se revela que existen); el ADMIN ve todas
  private async findOwned(id: string, viewer: Viewer): Promise<GatewayTransaction> {
    const transaction = await this.db.gatewayTransaction.findUnique({ where: { id } });
    if (!transaction || (transaction.userId !== viewer.id && !isAdmin(viewer))) throw GatewayError.notFound(id);
    return transaction;
  }

  private async toResponse(transaction: GatewayTransaction, intent?: PaymentIntentDto, viewer?: Viewer): Promise<PaymentResponse> {
    // El estado del pago se lee de la tabla payments (lo confirma el webhook firmado de Stripe)
    const payment = transaction.paymentId && viewer ? await this.payments.getPaymentById(transaction.paymentId, viewer).catch(() => null) : null;
    return {
      id: transaction.id,
      provider: transaction.provider,
      status: transaction.status,
      paymentId: transaction.paymentId,
      paymentStatus: payment?.status ?? null,
      attempts: transaction.attempts,
      lastError: transaction.lastError,
      circuit: this.breaker.snapshot().state,
      createdAt: transaction.createdAt,
      // Spread condicional: el client_secret solo viaja en la respuesta de process/retry
      ...(intent ? { clientSecret: intent.clientSecret, amountCents: intent.amountCents, currency: intent.currency } : {}),
    };
  }
}

export const gatewayService = new GatewayService();
