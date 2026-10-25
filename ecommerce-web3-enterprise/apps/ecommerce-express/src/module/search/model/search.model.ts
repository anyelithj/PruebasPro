// search.model.ts (Mongoose / MongoDB) => SearchHistory (Historial de Búsqueda) + tipos de SearchResult.
// El historial es un log append-only de alto volumen: MongoDB con índice TTL lo mantiene acotado sin jobs.
import { Schema, model, type InferSchemaType } from "mongoose";

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

const searchHistorySchema = new Schema(
  {
    userId: { type: String, required: true }, // UUID del usuario (referencia lógica a PostgreSQL)
    query: { type: String, required: true, maxlength: 200 },
    filters: { type: Schema.Types.Mixed, default: {} }, // Facetas aplicadas (categoría, marca, precio)
    resultsCount: { type: Number, default: 0 }, // Búsquedas con 0 resultados = insumo para mejorar el catálogo
    source: { type: String, enum: ["TEXT", "IMAGE"], default: "TEXT" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

searchHistorySchema.index({ userId: 1, createdAt: -1 }); // "Mis búsquedas recientes"
searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS_SECONDS }); // Retención 90 días

export type SearchHistoryRecord = InferSchemaType<typeof searchHistorySchema>;
export const SearchHistoryModel = model("SearchHistory", searchHistorySchema);
