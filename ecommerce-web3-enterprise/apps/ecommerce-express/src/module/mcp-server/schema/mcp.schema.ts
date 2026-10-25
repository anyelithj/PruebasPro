// mcp.schema.ts => validación Zod del módulo MCP Server (TransactionSchema, RollbackSchema, SagaSchema).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { SAGA_STEP_NAMES } from "../saga/mcp.saga";
import { TransactionStatuses } from "../model/mcp.model";

// SagaSchema => un paso: nombre del registro + entrada (se valida después con el schema propio del paso)
export const SagaSchema = z.object({
  name: z.enum(SAGA_STEP_NAMES),
  input: z.record(z.unknown()).default({}),
});

// TransactionSchema => POST /api/v1/mcp: operación crítica con sus pasos (máx. 20) y clave de idempotencia opcional
export const TransactionSchema = z.object({
  type: z.string().trim().min(3).max(80),
  steps: z.array(SagaSchema).min(1).max(20),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
});

// RollbackSchema => POST /api/v1/mcp/:id/rollback: motivo de la compensación (queda en la bitácora)
export const RollbackSchema = z.object({ reason: z.string().trim().min(3).max(200).default("Rollback manual") });

export const ListTransactionsQuerySchema = PaginationQuerySchema.extend({ status: z.enum(TransactionStatuses).optional() });

export type TransactionInput = z.infer<typeof TransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
