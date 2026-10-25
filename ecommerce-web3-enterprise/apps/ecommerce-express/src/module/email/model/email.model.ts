// email.model.ts (Mongoose / MongoDB) => EmailLog (historial de envíos con tracking de apertura) y EmailTemplate
// (plantillas con variables dinámicas del panel). MongoDB: registros de alto volumen sin relaciones; el historial
// se borra solo pasado su tiempo de retención (índice TTL => menos disco y menos energía de almacenamiento).
import { Schema, model, type InferSchemaType } from "mongoose";

// Estados de un envío (patrón State): QUEUED -> SENT | FAILED
export const EmailStatuses = ["QUEUED", "SENT", "FAILED"] as const;
export type EmailStatus = (typeof EmailStatuses)[number];

const LOG_RETENTION_SECONDS = 180 * 24 * 60 * 60; // 6 meses de historial

const emailLogSchema = new Schema(
  {
    to: { type: String, required: true, lowercase: true },
    subject: { type: String, required: true, maxlength: 200 },
    templateId: { type: Schema.Types.ObjectId, ref: "EmailTemplate", default: null },
    campaignId: { type: Schema.Types.ObjectId, default: null }, // Campaña de Marketing que originó el envío
    status: { type: String, enum: EmailStatuses, default: "QUEUED" },
    error: { type: String, default: null },
    sentBy: { type: String, default: null }, // Administrador que lo envió (null = sistema)
    openCount: { type: Number, default: 0 }, // Aperturas registradas por el píxel de tracking
    openedAt: { type: Date, default: null }, // Primera apertura
    // RF-21.5 clics (enlaces firmados) y conversión: compra dentro de los 7 días siguientes al clic
    clickCount: { type: Number, default: 0 },
    clickedAt: { type: Date, default: null },
    convertedAt: { type: Date, default: null },
    revenueCents: { type: Number, default: 0 },
    variant: { type: String, enum: ["A", "B", null], default: null }, // RF-21.4 variante de la prueba A/B
    sentAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
emailLogSchema.index({ createdAt: -1 }); // Historial más reciente primero
emailLogSchema.index({ campaignId: 1, status: 1 }); // Métricas por campaña
emailLogSchema.index({ to: 1, clickedAt: -1 }); // RF-21.5 atribución: último clic del cliente antes de comprar
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: LOG_RETENTION_SECONDS }); // TTL

const emailTemplateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, maxlength: 120 },
    subject: { type: String, required: true, maxlength: 200 },
    html: { type: String, required: true, maxlength: 100_000 },
    text: { type: String, default: null, maxlength: 50_000 },
    variables: { type: [String], default: [] }, // Derivadas de "{{ x }}" al guardar (no las escribe el usuario)
    blocks: { type: Schema.Types.Mixed, default: null }, // RF-21.6 diseño por bloques (el HTML se genera de aquí)
    locale: { type: String, enum: ["es", "en"], default: "es" },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export type EmailLogRecord = InferSchemaType<typeof emailLogSchema>;
export type EmailTemplateRecord = InferSchemaType<typeof emailTemplateSchema>;
export const EmailLogModel = model("EmailLog", emailLogSchema);
export const EmailTemplateModel = model("EmailTemplate", emailTemplateSchema);
