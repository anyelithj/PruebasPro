// mcp.model.ts (Mongoose / MongoDB) => MCPTransaction: operación crítica distribuida ejecutada como SAGA orquestada.
// Cada paso guarda entrada, salida y estado; "log" es la bitácora append-only (event sourcing ligero): permite
// reconstruir qué pasó y compensar en orden inverso. MongoDB: documento autocontenido (pasos embebidos, sin JOINs).
import { Schema, model, type InferSchemaType } from "mongoose";

// Estados de la transacción (patrón State):
// PENDING -> RUNNING -> COMPLETED | (falla) -> COMPENSATING -> COMPENSATED | FAILED (compensación incompleta)
// COMPLETED -> (rollback manual) -> COMPENSATING -> COMPENSATED ; PENDING -> CANCELLED
export const TransactionStatuses = ["PENDING", "RUNNING", "COMPLETED", "COMPENSATING", "COMPENSATED", "FAILED", "CANCELLED"] as const;
export type TransactionStatus = (typeof TransactionStatuses)[number];

export const StepStatuses = ["PENDING", "DONE", "FAILED", "COMPENSATED", "SKIPPED"] as const;
export type StepStatus = (typeof StepStatuses)[number];

const RETENTION_SECONDS = 90 * 24 * 60 * 60; // 90 días de historial transaccional

const stepSchema = new Schema(
  {
    name: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
    output: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: StepStatuses, default: "PENDING" },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { _id: false } // Subdocumento sin ID propio: se identifica por su posición
);

const mcpTransactionSchema = new Schema(
  {
    type: { type: String, required: true, maxlength: 80 }, // Etiqueta de negocio ("restock", "promo-flash"...)
    status: { type: String, enum: TransactionStatuses, default: "PENDING" },
    steps: { type: [stepSchema], default: [] },
    log: { type: [{ at: Date, message: String, _id: false }], default: [] },
    // "sparse" => la unicidad solo aplica a documentos que traen la clave (reintento del cliente = misma transacción)
    idempotencyKey: { type: String, default: undefined, unique: true, sparse: true },
    createdBy: { type: String, required: true },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);
mcpTransactionSchema.index({ status: 1, createdAt: -1 });
mcpTransactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS }); // TTL

export type McpTransactionRecord = InferSchemaType<typeof mcpTransactionSchema>;
export const McpTransactionModel = model("McpTransaction", mcpTransactionSchema);
