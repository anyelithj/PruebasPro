// automation.model.ts (Mongoose / MongoDB) => Workflow (flujo de n8n registrado en la tienda) y WorkflowRun (bitácora
// de cada ejecución). MongoDB: logs de alto volumen sin transacciones; las ejecuciones viejas se borran solas (TTL).
import { Schema, model, type InferSchemaType } from "mongoose";
import type { CommerceEvents } from "../../order/event/order.event";

// Disparadores. EVENT y MANUAL los ejecuta Express; SCHEDULE y WEBHOOK los ejecuta n8n con sus propios nodos
// (Schedule Trigger / Webhook): Express no mantiene un cron extra (menos procesos despiertos = menos energía).
export const TriggerTypes = ["EVENT", "MANUAL", "SCHEDULE", "WEBHOOK"] as const;
export type TriggerType = (typeof TriggerTypes)[number];

// Eventos de dominio que pueden disparar un flujo ("satisfies" => el compilador verifica que existan en el bus)
export const COMMERCE_AUTOMATION_EVENTS = [
  "order.placed",
  "order.status-changed",
  "order.cancelled",
  "payment.failed",
  "shipment.updated",
  "refund.updated",
  "invoice.issued",
  "loyalty.tier-upgraded",
  "review.moderated",
] as const satisfies ReadonlyArray<keyof CommerceEvents>;
// RF-20.2 / RF-20.8 eventos de otros módulos: inventario (stock bajo, ajustes) y retención (cliente inactivo)
export const AUTOMATION_EVENTS = [...COMMERCE_AUTOMATION_EVENTS, "inventory.low", "inventory.adjusted", "customer.inactive"] as const;
export type AutomationEvent = (typeof AUTOMATION_EVENTS)[number];

// Estados de una ejecución (patrón State): RUNNING -> SUCCESS | FAILED
export const RunStatuses = ["RUNNING", "SUCCESS", "FAILED"] as const;
export type RunStatus = (typeof RunStatuses)[number];

const RUN_RETENTION_SECONDS = 90 * 24 * 60 * 60; // 90 días de bitácora auditable

const workflowSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    description: { type: String, default: null, maxlength: 500 },
    triggerType: { type: String, enum: TriggerTypes, required: true },
    event: { type: String, enum: [...AUTOMATION_EVENTS, null], default: null }, // Solo para EVENT
    webhookPath: { type: String, required: true }, // Ruta del nodo Webhook de n8n (bajo N8N_WEBHOOK_URL)
    n8nWorkflowId: { type: String, default: null }, // ID en n8n si se creó desde aquí con "definition"
    active: { type: Boolean, default: true },
    version: { type: Number, default: 1 }, // Se incrementa en cada PATCH (versionado simple)
    createdBy: { type: String, required: true },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);
workflowSchema.index({ active: 1, triggerType: 1, event: 1 }); // Búsqueda de flujos al llegar un evento

const workflowRunSchema = new Schema(
  {
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow", required: true },
    trigger: { type: String, enum: TriggerTypes, required: true },
    status: { type: String, enum: RunStatuses, default: "RUNNING" },
    attempts: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    httpStatus: { type: Number, default: null },
    error: { type: String, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
workflowRunSchema.index({ workflowId: 1, createdAt: -1 }); // Logs de un flujo, más recientes primero
workflowRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: RUN_RETENTION_SECONDS }); // TTL

export type WorkflowRecord = InferSchemaType<typeof workflowSchema>;
export const WorkflowModel = model("Workflow", workflowSchema);
export const WorkflowRunModel = model("WorkflowRun", workflowRunSchema);

// WorkflowVersion => RF-20.7 historial de cambios: copia de la configuración ANTES de cada modificación (quién y cuándo)
const workflowVersionSchema = new Schema(
  {
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow", required: true },
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true }, // name, description, triggerType, event, webhookPath, active
    changedBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
workflowVersionSchema.index({ workflowId: 1, version: -1 });
export const WorkflowVersionModel = model("WorkflowVersion", workflowVersionSchema);
