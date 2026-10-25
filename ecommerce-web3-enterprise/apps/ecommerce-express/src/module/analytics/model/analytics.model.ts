// analytics.model.ts (Mongoose / MongoDB) => AnalyticEvent: evento de tracking del usuario (page_view, view_item,
// add_to_cart, begin_checkout, purchase...). MongoDB: escritura masiva sin relaciones; índice TTL de 90 días =>
// los eventos crudos se borran solos (los agregados de ventas se calculan siempre desde PostgreSQL, no se pierden).
import { Schema, model, type InferSchemaType } from "mongoose";

// Tipos de evento: mismos nombres que los eventos de e-commerce de GA4 (el frontend publica ambos: DRY)
export const EventTypes = [
  "page_view",
  "click",
  "search",
  "view_item",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "web_vital", // RF-24.8 rendimiento de la página (LCP, CLS, INP, TTFB, carga)
] as const;
export type EventType = (typeof EventTypes)[number];

// FUNNEL => pasos del embudo de conversión en orden (visualización paso a paso en el panel)
export const FUNNEL: readonly EventType[] = ["page_view", "view_item", "add_to_cart", "begin_checkout", "purchase"];

export const Granularities = ["day", "week", "month", "quarter", "year"] as const; // RF-24.9 trimestre y año
export type Granularity = (typeof Granularities)[number];

const RETENTION_SECONDS = 90 * 24 * 60 * 60; // 90 días de eventos crudos

const analyticEventSchema = new Schema(
  {
    type: { type: String, enum: EventTypes, required: true },
    sessionId: { type: String, required: true, maxlength: 64 }, // ID anónimo de sesión del navegador (sin datos personales)
    userId: { type: String, default: null }, // Solo si el usuario inició sesión
    path: { type: String, required: true, maxlength: 300 },
    productId: { type: String, default: null },
    value: { type: Number, default: null }, // Monto en unidad mínima (purchase / add_to_cart)
    channel: { type: String, default: null, maxlength: 60 }, // Origen (utm_source o red social)
    referrer: { type: String, default: null, maxlength: 300 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
analyticEventSchema.index({ type: 1, createdAt: -1 }); // Series y embudo por tipo y período
analyticEventSchema.index({ type: 1, path: 1, createdAt: -1 }); // RF-24.8 mapa de calor y rendimiento por ruta
analyticEventSchema.index({ userId: 1, createdAt: 1 }, { partialFilterExpression: { userId: { $type: "string" } } }); // RF-22.9 recorrido
analyticEventSchema.index({ productId: 1, type: 1 }, { partialFilterExpression: { productId: { $type: "string" } } }); // Análisis por producto
analyticEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS }); // TTL

export type AnalyticEventRecord = InferSchemaType<typeof analyticEventSchema>;
export const AnalyticEventModel = model("AnalyticEvent", analyticEventSchema);
