// webhook.model.ts (Mongoose / MongoDB) => Webhook (endpoint externo suscrito a eventos, con secreto de firma y
// política de reintentos) y WebhookDelivery (bitácora de cada entrega). Las entregas viejas se borran solas (TTL).
import { Schema, model, type InferSchemaType } from "mongoose";
import { COMMERCE_AUTOMATION_EVENTS } from "../../automation/model/automation.model";

// Eventos suscribibles: los del bus de comercio (mismo catálogo que n8n: DRY) + inventario + CMS (Nuxt purga su ISR)
// + prueba manual
export const WEBHOOK_EVENTS = [...COMMERCE_AUTOMATION_EVENTS, "inventory.low", "cms.updated", "webhook.test"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

// Estados de una entrega (patrón State): PENDING -> SUCCESS | FAILED
export const DeliveryStatuses = ["PENDING", "SUCCESS", "FAILED"] as const;
export type DeliveryStatus = (typeof DeliveryStatuses)[number];

const DELIVERY_RETENTION_SECONDS = 30 * 24 * 60 * 60; // 30 días de logs de entrega

const webhookSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    url: { type: String, required: true, maxlength: 500 },
    // "select: false" => el secreto NUNCA sale en las consultas por defecto (solo cuando el despachador firma)
    secret: { type: String, required: true, select: false },
    events: { type: [String], enum: WEBHOOK_EVENTS, required: true },
    active: { type: Boolean, default: true },
    maxAttempts: { type: Number, min: 1, max: 10, default: 5 }, // Retry policy: intentos con backoff exponencial
    createdBy: { type: String, required: true },
    lastDeliveryAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);
webhookSchema.index({ active: 1, events: 1 }); // Endpoints a notificar cuando ocurre un evento (índice multikey)

const webhookDeliverySchema = new Schema(
  {
    webhookId: { type: Schema.Types.ObjectId, ref: "Webhook", required: true },
    event: { type: String, required: true },
    status: { type: String, enum: DeliveryStatuses, default: "PENDING" },
    attempts: { type: Number, default: 0 },
    httpStatus: { type: Number, default: null },
    durationMs: { type: Number, default: 0 },
    error: { type: String, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
webhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: DELIVERY_RETENTION_SECONDS }); // TTL

export type WebhookRecord = InferSchemaType<typeof webhookSchema>;
export const WebhookModel = model("Webhook", webhookSchema);
export const WebhookDeliveryModel = model("WebhookDelivery", webhookDeliverySchema);
