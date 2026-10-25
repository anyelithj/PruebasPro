// gateway.error.ts (TypeScript) => errores de dominio del proxy de pagos (CircuitOpen, Timeout, Unavailable...).
// Patrón Factory Method sobre DomainException; el error.middleware los traduce a HTTP.
import { DomainException } from "../../../shared/filter/http-exception.filter";

export class GatewayError extends DomainException {
  // circuitOpen => el proveedor falló varias veces seguidas: se responde al instante sin llamarlo (fail fast)
  public static circuitOpen(provider: string, retryInMs: number): GatewayError {
    return new GatewayError(503, "CIRCUIT_OPEN", `El proveedor ${provider} no está disponible; reintenta en ${Math.ceil(retryInMs / 1000)} s`, { retryInMs });
  }

  public static timeout(provider: string, timeoutMs: number): GatewayError {
    return new GatewayError(504, "GATEWAY_TIMEOUT", `El proveedor ${provider} no respondió en ${timeoutMs} ms`);
  }

  public static unavailable(provider: string): GatewayError {
    return new GatewayError(502, "GATEWAY_UNAVAILABLE", `El proveedor ${provider} respondió con error`);
  }

  public static notFound(id: string): GatewayError {
    return new GatewayError(404, "GATEWAY_TRANSACTION_NOT_FOUND", `Transacción ${id} no encontrada`);
  }

  public static notRetryable(status: string): GatewayError {
    return new GatewayError(409, "GATEWAY_NOT_RETRYABLE", `Solo se reintenta una transacción FAILED (estado actual: ${status})`);
  }

  // idempotencyConflict => la misma Idempotency-Key llegó con otro cuerpo u otro usuario
  public static idempotencyConflict(): GatewayError {
    return new GatewayError(409, "IDEMPOTENCY_KEY_CONFLICT", "La Idempotency-Key ya se usó con otros datos");
  }
}
