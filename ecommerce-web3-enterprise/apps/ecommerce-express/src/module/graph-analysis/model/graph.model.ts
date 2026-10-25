// graph.model.ts (Mongoose / MongoDB) => GraphQueryResult: cada análisis del grafo de productos que se ejecuta queda
// guardado (nodos, aristas y resumen) para listarlo y volver a verlo sin recalcular (ahorro de CPU).
// El grafo NO vive en una base de grafos aparte (Neo4j): los nodos son productos de PostgreSQL y las aristas se
// calculan con SQL sobre order_items => una base de datos menos encendida (app ecológica).
import { Schema, model, type InferSchemaType } from "mongoose";

// Tipos de consulta (body: { queryType, params } de la matriz)
export const GraphQueryTypes = ["RELATED", "PURCHASED_TOGETHER", "SIMILAR", "CLUSTER"] as const;
export type GraphQueryType = (typeof GraphQueryTypes)[number];

const RETENTION_SECONDS = 30 * 24 * 60 * 60; // 30 días: los análisis viejos se recalculan si se necesitan

// Subdocumentos sin _id propio ("_id: false"): menos bytes por documento
const nodeSchema = new Schema(
  { id: { type: String, required: true }, name: { type: String, required: true }, slug: { type: String, required: true }, group: { type: Number, default: 0 } },
  { _id: false }
);
const edgeSchema = new Schema(
  { source: { type: String, required: true }, target: { type: String, required: true }, weight: { type: Number, required: true } },
  { _id: false }
);

const graphResultSchema = new Schema(
  {
    queryType: { type: String, enum: GraphQueryTypes, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    nodes: { type: [nodeSchema], default: [] },
    edges: { type: [edgeSchema], default: [] },
    summary: { type: String, default: null }, // Lectura del grafo en lenguaje natural (LangGraph + Ollama), opcional
    durationMs: { type: Number, default: 0 },
    createdBy: { type: String, required: true }, // UUID del administrador que lo ejecutó
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

graphResultSchema.index({ createdAt: -1 });
graphResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS }); // TTL: limpieza automática

export type GraphResultRecord = InferSchemaType<typeof graphResultSchema>;
export const GraphResultModel = model("GraphQueryResult", graphResultSchema);
