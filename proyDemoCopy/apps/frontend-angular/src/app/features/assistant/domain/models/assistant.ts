import { z } from 'zod';
import { parseSseText, type SseData, type SseMessage } from '@shared/utils/event-source';
// [Modelo Assistant · Dominio]: mensaje al tutor, turnos de la conversación y trozos del flujo SSE (session/token/done) + parser puro del flujo | [Patrón]: Schema-First (Zod) + Tagged Union (ChatChunk) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional

import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
export const TUTOR_LANGUAGES = LANGUAGES; // [Sprint 7.1]: valores compartidos (packages/shared-schemas), espejo del enum Language de NestJS
export type TutorLanguage = (typeof TUTOR_LANGUAGES)[number];
export const TUTOR_LEVELS = CEFR_LEVELS; // [Sprint 7.8]: A1–C2 → el tutor gradúa la respuesta y la pantalla toma el color del nivel
export type TutorLevel = (typeof TUTOR_LEVELS)[number];

export const ChatInputSchema = z.object({
  message: z.string().trim().min(1).max(2000), // Igual que ChatBody (NestJS)
  sessionId: z.string().uuid().optional(),
  language: z.enum(TUTOR_LANGUAGES).optional(),
  level: z.enum(TUTOR_LEVELS).optional(),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// [ChatChunk]: unión discriminada por `type` → `switch` exhaustivo en la fachada
export type ChatChunk =
  { type: 'session'; sessionId: string } | { type: 'token'; text: string } | { type: 'done' };

// [toChatChunk]: mensaje SSE genérico (shared/utils/event-source) → trozo del tutor | null = evento ajeno (p. ej. `sources`) | Puro
export function toChatChunk({ type, data }: SseMessage<SseData>): ChatChunk | null {
  if (type === 'session' && typeof data['session_id'] === 'string')
    return { type: 'session', sessionId: data['session_id'] };
  if (type === 'token' && typeof data['text'] === 'string')
    return { type: 'token', text: data['text'] };
  return type === 'done' ? { type: 'done' } : null;
}

// [parseSseFrames]: texto SSE acumulado → trozos del tutor + resto sin terminar | Puro (DRY: el parser vive en shared/utils/event-source)
export function parseSseFrames(buffer: string): { chunks: ChatChunk[]; rest: string } {
  const { messages, rest } = parseSseText(buffer);
  return { chunks: messages.map(toChatChunk).filter((c): c is ChatChunk => c !== null), rest };
}
