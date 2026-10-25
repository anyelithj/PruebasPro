// realtime_analytic.model.ts (Mongoose + MongoDB) => eventos de analítica de alta frecuencia (sprint 9.1).
// Se guardan por LOTES (insertMany) desde el buffer en memoria y se borran solos con un índice TTL de 30 días:
// MongoDB elimina los documentos vencidos sin jobs ni consultas extra (menos disco, menos energía).
// Colección propia "rt_analytic_events": no se mezcla con la analítica de negocio del módulo analytics (Fase 7).
import { Schema, model, type InferSchemaType } from "mongoose";

const RETENTION_SECONDS = 30 * 24 * 60 * 60; // 30 días: los agregados históricos viven en analytics/FastAPI

// Dimensiones de la matriz: producto, categoría, región y canal
export const Dimensions = ["product", "category", "region", "channel"] as const;
export type Dimension = (typeof Dimensions)[number];

const analyticEventSchema = new Schema(
  {
    type: { type: String, required: true, maxlength: 40 }, // "page_view", "add_to_cart", "purchase"...
    value: { type: Number, default: 1 }, // Monto (purchase) o 1 (conteo)
    userId: { type: String, default: null },
    sessionId: { type: String, required: true, maxlength: 64 },
    // "_id: false" => subdocumento sin ObjectId propio (menos bytes por evento)
    dimensions: {
      type: new Schema({ product: String, category: String, region: String, channel: String }, { _id: false }),
      default: {},
    },
    occurredAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "rt_analytic_events" }
);
analyticEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS }); // Índice TTL
analyticEventSchema.index({ type: 1, occurredAt: -1 }); // Consultas históricas por tipo

export type AnalyticEventRecord = InferSchemaType<typeof analyticEventSchema>;
export const RealtimeAnalyticEventModel = model("RealtimeAnalyticEvent", analyticEventSchema);
