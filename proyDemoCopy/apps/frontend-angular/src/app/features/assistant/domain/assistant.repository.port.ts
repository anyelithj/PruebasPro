import type { Observable } from 'rxjs';
import type { ChatChunk, ChatInput, ConversationDetail, ConversationSummary } from './models/assistant';
// [Puerto AssistantRepository · Dominio]: enviar un mensaje y recibir la respuesta del tutor en trozos + [2026-10-28] CRUD de conversaciones y mensajes | [Patrón]: Port (Hexagonal) + Repository + Iterator (flujo de trozos) | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección

export abstract class AssistantRepository {
  // [stream]: emite session → token… → saved → done y completa; desuscribirse cancela la petición
  abstract stream(input: ChatInput): Observable<ChatChunk>;
  abstract list(): Observable<ConversationSummary[]>;
  abstract get(id: string): Observable<ConversationDetail>;
  abstract rename(id: string, title: string): Observable<ConversationSummary>;
  abstract remove(id: string): Observable<void>;
  // [editMessage]: el servidor trunca lo posterior y el tutor responde de nuevo → conversación completa actualizada
  abstract editMessage(id: string, messageId: string, content: string): Observable<ConversationDetail>;
  abstract deleteMessage(id: string, messageId: string): Observable<ConversationDetail>;
}
