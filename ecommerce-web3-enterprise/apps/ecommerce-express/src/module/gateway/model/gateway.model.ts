// gateway.model.ts (Prisma + PostgreSQL) => modelo del proxy de pagos: tablas gateway_transactions y
// gateway_retry_attempts (migración 20261006000000_phase9_express_hpc). Los tipos los genera Prisma desde schema.prisma
// (una sola fuente de verdad); aquí se re-exportan y se agregan reglas puras del modelo.
import type { GatewayRetryAttempt, GatewayTransaction, GatewayTxStatus } from "@prisma/client";

// "export type { }" => re-exporta solo tipos (se borran al compilar: cero costo en runtime)
export type { GatewayRetryAttempt, GatewayTransaction, GatewayTxStatus };

// RESUMABLE => estados en los que repetir la llamada al PSP es seguro (el módulo payment reutiliza el intento abierto)
export const RESUMABLE: ReadonlySet<GatewayTxStatus> = new Set<GatewayTxStatus>(["PROCESSING", "PENDING"]);

// errorText => mensaje de error acotado a 500 caracteres para la columna lastError (sin stack: no filtra internals)
export function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
