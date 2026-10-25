// communication.dto.ts => contratos de salida del módulo Communication (REST y eventos de Socket.io usan los mismos).
import type { Channel, ConversationStatus, ConversationType, MessageRole } from "../model/communication.model";

export interface MessageDto {
  id: string;
  role: MessageRole;
  authorId: string | null;
  content: string;
  createdAt: Date;
  nlu?: NluInfo | null; // RF-17.2 solo en mensajes del cliente analizados
}

// NluInfo => resultado de FastAPI /ml/nlp/intent guardado junto al mensaje
export interface NluInfo {
  intent: string;
  score: number;
  entities: Array<{ label: string; text: string; value?: number }>;
  corrected: string; // RF-17.9 texto corregido
  lowConfidence: boolean;
}

// SupportMetricsDto => RF-17.12 tiempos de respuesta/resolución + precisión de la comprensión (FastAPI)
export interface SupportMetricsDto {
  days: number;
  conversations: number;
  escalated: number;
  escalationRate: number;
  lowConfidenceEscalations: number;
  avgFirstResponseSeconds: number | null;
  avgAgentResponseSeconds: number | null;
  avgResolutionMinutes: number | null;
  resolved: number;
  intents: Record<string, number>;
  nlu: Record<string, unknown> | null;
}

// ConversationSummaryDto => fila de la bandeja (sin historial: listado liviano)
export interface ConversationSummaryDto {
  id: string;
  userId: string;
  type: ConversationType;
  channel: Channel;
  status: ConversationStatus;
  agentId: string | null;
  escalationReason: string | null;
  chatwootId: string | null; // RF-17.11
  resolvedAt: Date | null;
  lastMessage: MessageDto | null;
  lastMessageAt: Date;
  createdAt: Date;
}

// ConversationDto => detalle con el historial completo
export interface ConversationDto extends Omit<ConversationSummaryDto, "lastMessage"> {
  messages: MessageDto[];
}
