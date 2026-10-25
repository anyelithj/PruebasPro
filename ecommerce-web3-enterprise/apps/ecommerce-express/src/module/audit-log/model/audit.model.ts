// audit.model.ts (Mongoose / MongoDB) => AuditLog: registro INMUTABLE de quién hizo qué, cuándo y desde dónde.
// MongoDB: alto volumen de escritura, sin relaciones ni transacciones. Patrón Memento (cada documento es una foto
// del estado de la acción que no se modifica) + índice TTL: los logs vencidos se borran solos (retention policy).
// "immutable: true" (Mongoose) => el campo no se puede cambiar después de crearse: solo la revisión es editable.
import { Schema, model, type InferSchemaType } from "mongoose";
import { appConfig } from "../../../config/app.config";

// Severidad del evento (las alertas del panel filtran por CRITICAL)
export const AuditSeverities = ["INFO", "WARNING", "CRITICAL"] as const;
export type AuditSeverity = (typeof AuditSeverities)[number];

// Origen del registro: request HTTP de la API, evento de dominio del bus o servicio externo (n8n, FastAPI)
export const AuditSources = ["HTTP", "EVENT", "EXTERNAL"] as const;
export type AuditSource = (typeof AuditSources)[number];

const DAY_SECONDS = 24 * 60 * 60;

const auditLogSchema = new Schema(
  {
    actorId: { type: String, default: null, immutable: true }, // null => sistema (evento sin usuario)
    actorRoles: { type: [String], default: [], immutable: true },
    action: { type: String, required: true, maxlength: 200, immutable: true }, // "PATCH /api/v1/product/:id" o "order.cancelled"
    module: { type: String, required: true, maxlength: 60, immutable: true }, // Segmento del módulo ("product", "order"...)
    resourceId: { type: String, default: null, immutable: true },
    source: { type: String, enum: AuditSources, required: true, immutable: true },
    severity: { type: String, enum: AuditSeverities, default: "INFO", immutable: true },
    status: { type: Number, default: null, immutable: true }, // Código HTTP de la respuesta (solo source HTTP)
    ip: { type: String, default: null, immutable: true },
    metadata: { type: Schema.Types.Mixed, default: {}, immutable: true }, // Datos acotados (nunca bodies con contraseñas)
    // --- Únicos campos editables: la revisión del auditor (PATCH) ---
    reviewed: { type: Boolean, default: false },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
auditLogSchema.index({ createdAt: -1 }); // Listado más reciente primero
auditLogSchema.index({ actorId: 1, createdAt: -1 }); // Filtro por actor
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 }); // Filtro por módulo y acción
// RF-30.6 búsqueda de texto completo: índice "text" comodín ("$**") sobre todos los campos de texto, incluida la
// metadata de cualquier servicio (HTTP, eventos, n8n, FastAPI). MongoDB permite UN índice de texto por colección
auditLogSchema.index({ "$**": "text" }, { name: "audit_fulltext", default_language: "spanish" });
// TTL => MongoDB borra en segundo plano los documentos más viejos que la retención configurada (AUDIT_RETENTION_DAYS)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: appConfig.AUDIT_RETENTION_DAYS * DAY_SECONDS });

export type AuditLogRecord = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel = model("AuditLog", auditLogSchema);
