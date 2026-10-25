// communication.model.ts (Mongoose / MongoDB) => Conversation: chat del cliente con el bot IA o con un agente humano.
// Los mensajes van EMBEBIDOS en la conversación (una lectura trae todo el historial) con tope de cantidad: el
// documento nunca crece sin límite (MongoDB admite máx. 16 MB por documento) y se ahorra almacenamiento.
import { Schema, model, type InferSchemaType } from "mongoose";

export const ConversationTypes = ["AI", "HUMAN"] as const; // Quién responde: bot (LangChain + Ollama) o agente
export type ConversationType = (typeof ConversationTypes)[number];
export const Channels = ["WEB", "WHATSAPP", "EMAIL"] as const; // Hoy el transporte en vivo es WEB (Socket.io)
export type Channel = (typeof Channels)[number];
export const ConversationStatuses = ["OPEN", "ESCALATED", "ARCHIVED"] as const;
export type ConversationStatus = (typeof ConversationStatuses)[number];
export const MessageRoles = ["USER", "BOT", "AGENT"] as const;
export type MessageRole = (typeof MessageRoles)[number];

export const MAX_MESSAGES = 100; // Tope de mensajes guardados por conversación ("$slice" conserva los últimos)
const ARCHIVE_RETENTION_SECONDS = 90 * 24 * 60 * 60; // Archivadas: se borran solas a los 90 días (TTL)

const messageSchema = new Schema(
  {
    role: { type: String, enum: MessageRoles, required: true },
    authorId: { type: String, default: null }, // UUID del cliente o agente; null para el bot
    content: { type: String, required: true, maxlength: 4000 },
    // RF-17.2 / RF-17.12 comprensión del mensaje del cliente (intención, confianza, entidades, texto corregido)
    nlu: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Cada mensaje conserva su _id (clave en la lista de la UI)
);

const conversationSchema = new Schema(
  {
    userId: { type: String, required: true }, // Cliente dueño de la conversación
    type: { type: String, enum: ConversationTypes, default: "AI" },
    channel: { type: String, enum: Channels, default: "WEB" },
    status: { type: String, enum: ConversationStatuses, default: "OPEN" },
    agentId: { type: String, default: null }, // Primer agente que respondió tras el escalado
    escalationReason: { type: String, default: null, maxlength: 300 },
    escalatedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null }, // RF-17.12 tiempo de resolución (cierre por el agente o en Chatwoot)
    chatwootId: { type: String, default: null }, // RF-17.11 conversación espejo en Chatwoot
    lowConfidenceStreak: { type: Number, default: 0 }, // RF-17.10 mensajes seguidos que el bot no entendió
    lastMessageAt: { type: Date, default: () => new Date() },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

conversationSchema.index({ userId: 1, lastMessageAt: -1 }); // Bandeja del cliente
conversationSchema.index({ status: 1, channel: 1, lastMessageAt: -1 }); // Bandeja de agentes (activas por canal)
conversationSchema.index({ chatwootId: 1 }, { sparse: true }); // Webhook de Chatwoot -> conversación
conversationSchema.index({ createdAt: -1 }); // Métricas por período
// TTL parcial: solo aplica a las archivadas (archivedAt con fecha); las activas tienen null y nunca expiran
conversationSchema.index({ archivedAt: 1 }, { expireAfterSeconds: ARCHIVE_RETENTION_SECONDS });

export type ConversationRecord = InferSchemaType<typeof conversationSchema>;
export const ConversationModel = model("Conversation", conversationSchema);
