// notification.model.ts (Mongoose / MongoDB) => bandeja de notificaciones in-app.
// ¿Por qué MongoDB y no PostgreSQL? Alta tasa de escritura, documentos sin relaciones y payload flexible
// ("data" varía por tipo de evento): encaja con un almacén de documentos (persistencia políglota).
import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Tipos de notificación (categorías para filtros e iconos en la UI)
export const NotificationTypes = [
  "ORDER",
  "PAYMENT",
  "SHIPPING",
  "REFUND",
  "REVIEW",
  "LOYALTY",
  "SECURITY",
  "PROMOTION",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NotificationTypes)[number];

// Canales de entrega (patrón Strategy en notification.service: un canal = una estrategia)
export const NotificationChannels = ["IN_APP", "EMAIL", "PUSH", "WHATSAPP", "SMS"] as const; // RF-16.1
export type NotificationChannel = (typeof NotificationChannels)[number];

const RETENTION_SECONDS = 180 * 24 * 60 * 60; // Retención de la bandeja: 180 días

// "new Schema({...}, options)" => define forma, tipos y validaciones del documento
const notificationSchema = new Schema(
  {
    userId: { type: String, required: true }, // UUID del usuario en PostgreSQL (referencia lógica); indexado por el índice compuesto
    type: { type: String, enum: NotificationTypes, required: true },
    // Clave + parámetros del mensaje (messages.constants): el texto se redacta al LEER, en el idioma de quien consulta.
    // "title"/"body" guardan la versión en el idioma del destinatario al crearla (respaldo y mensajes libres de admin)
    messageKey: { type: String, default: null },
    params: { type: Schema.Types.Mixed, default: {} },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, required: true, maxlength: 1000 },
    url: { type: String }, // Enlace profundo en el frontend (ej. /account/orders/123)
    data: { type: Schema.Types.Mixed, default: {} }, // Payload libre (IDs relacionados)
    channels: { type: [String], enum: NotificationChannels, default: ["IN_APP"] },
    readAt: { type: Date, default: null }, // null = no leída
    // RF-16.5 agrupación inteligente: avisos iguales (tipo + clave + enlace) no leídos dentro de la ventana se suman
    // en UN registro ("count") en vez de llenar la bandeja; "lastAt" ordena por la ocurrencia más reciente
    groupKey: { type: String, default: null },
    count: { type: Number, default: 1 },
    lastAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true, // Agrega createdAt/updatedAt automáticamente
    versionKey: false, // Quita el campo "__v" (no se usa control de versiones optimista aquí)
  }
);

// Índice compuesto: bandeja del usuario ordenada por fecha (consulta más frecuente)
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, lastAt: -1 }); // Bandeja ordenada por la última ocurrencia (grupos)
notificationSchema.index({ userId: 1, groupKey: 1, readAt: 1 }); // Búsqueda del grupo abierto al crear
// Índice TTL: MongoDB borra solo los documentos más viejos que la retención (sin cron jobs)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

// "InferSchemaType" => tipo TypeScript derivado del schema (DRY: sin interfaz duplicada a mano)
export type NotificationRecord = InferSchemaType<typeof notificationSchema>;
export type NotificationDocument = HydratedDocument<NotificationRecord>;

// "model(nombre, schema)" => clase Model con los métodos de consulta (find, create...); patrón Active Record
export const NotificationModel = model("Notification", notificationSchema);
