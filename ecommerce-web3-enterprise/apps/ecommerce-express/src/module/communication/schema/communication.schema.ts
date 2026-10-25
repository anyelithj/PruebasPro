// communication.schema.ts => validación Zod del módulo Communication (REST y mensajes de Socket.io: misma regla, DRY).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { Channels, ConversationStatuses, ConversationTypes } from "../model/communication.model";
import { ContactStatuses, ContactTopics } from "../service/contact.service";

const Content = z.string().trim().min(1).max(2000);
const ObjectId = z.string().regex(/^[a-f0-9]{24}$/i, { message: "conversationId inválido" });

// CreateConversationSchema => POST /api/v1/communication ("tipo [HUMAN|AI] en DTO")
export const CreateConversationSchema = z.object({
  type: z.enum(ConversationTypes).default("AI"),
  channel: z.enum(Channels).default("WEB"),
  message: Content.optional(), // Primer mensaje opcional
});

// MessageSchema => evento "chat:message" de Socket.io
export const MessageSchema = z.object({ conversationId: ObjectId, content: Content });
// JoinSchema => evento "chat:join" de Socket.io
export const JoinSchema = z.object({ conversationId: ObjectId });

// EscalationSchema => PATCH /api/v1/communication/:id/escalate
export const EscalationSchema = z.object({ reason: z.string().trim().min(3).max(300).default("Solicitado por el cliente") });

export const ListConversationsQuerySchema = PaginationQuerySchema.extend({
  channel: z.enum(Channels).optional(),
  status: z.enum(ConversationStatuses).optional(),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;

// ---------- RF-17.11 Chatwoot / RF-17.12 métricas ----------
export const PostMessageSchema = z.object({ content: Content });
export const AssignSchema = z.object({ assigneeId: z.coerce.number().int().positive().optional() }); // Sin id => automática
export const CannedSchema = z.object({ shortCode: z.string().trim().regex(/^[a-z0-9_-]{2,30}$/), content: z.string().trim().min(3).max(2000) });
export const MetricsQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
// ChatwootWebhookSchema => solo los campos que se usan (passthrough tolera el resto del payload de Chatwoot)
export const ChatwootWebhookSchema = z
  .object({
    event: z.string(),
    id: z.union([z.number(), z.string()]).optional(),
    content: z.string().nullish(),
    message_type: z.union([z.string(), z.number()]).optional(),
    private: z.boolean().optional(),
    status: z.string().optional(),
    content_attributes: z.record(z.unknown()).nullish(),
    sender: z.object({ id: z.union([z.number(), z.string()]).optional(), type: z.string().optional(), name: z.string().optional() }).passthrough().nullish(),
    conversation: z.object({ id: z.union([z.number(), z.string()]) }).passthrough().optional(),
  })
  .passthrough();

// ---------- RF-21.2 formulario de contacto ----------
export const ContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  topic: z.enum(ContactTopics).default("OTHER"),
  orderNumber: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).optional(), // Honeypot: debe llegar vacío
});
export const ContactListQuerySchema = PaginationQuerySchema.extend({ status: z.enum(ContactStatuses).optional() });
export const ContactUpdateSchema = z.object({ status: z.enum(ContactStatuses).optional(), reply: z.string().trim().min(3).max(5000).optional() });
