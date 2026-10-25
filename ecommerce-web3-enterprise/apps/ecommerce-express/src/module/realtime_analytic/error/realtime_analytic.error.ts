// realtime_analytic.error.ts (TypeScript) => errores de dominio de la analítica en tiempo real.
// Patrón Factory Method sobre DomainException (el error.middleware los traduce a HTTP).
import { DomainException } from "../../../shared/filter/http-exception.filter";

export class AnalyticError extends DomainException {
  // bufferFull => protección de memoria: si MongoDB no responde y el lote pendiente llegó al tope, se rechaza (503)
  public static bufferFull(): AnalyticError {
    return new AnalyticError(503, "ANALYTIC_BUFFER_FULL", "El buffer de eventos está lleno; reintenta en unos segundos");
  }
}
