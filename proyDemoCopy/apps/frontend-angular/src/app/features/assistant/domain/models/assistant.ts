import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
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

// ───── [2026-10-28] Conversaciones guardadas (NestJS /ai/assistant/conversations) + uso del idioma meta ─────

// [Meta mínima por nivel]: % de palabras del alumno en el idioma meta | ESPEJO de TARGET_SHARE_BY_LEVEL (FastAPI · language_usage.py, SSOT)
// Solo se usa ANTES de la primera medición; después manda el `target` que devuelve el servidor | `as const satisfies` (TS 4.9): literal + comprobación de claves
export const TARGET_SHARE_BY_LEVEL = { A1: 0.3, A2: 0.4, B1: 0.6, B2: 0.75, C1: 0.9, C2: 1 } as const satisfies Record<TutorLevel, number>;

export const LanguageUsageSchema = z.object({
  language: z.string(),
  level: z.string(),
  ratio: z.number().min(0).max(1),
  target: z.number().min(0).max(1),
  words: z.number().int(),
  target_words: z.number().int(),
  turns: z.number().int(), // Mensajes que cuentan (posteriores al aviso del tutor)
  announced: z.boolean(), // ¿El tutor ya dijo cuándo escribir en el idioma meta?
  below: z.boolean(),
});
export type LanguageUsage = z.infer<typeof LanguageUsageSchema>;

export const TutorMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
});
export type TutorMessage = z.infer<typeof TutorMessageSchema>;

export const ConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  language: z.enum(TUTOR_LANGUAGES),
  level: z.enum(TUTOR_LEVELS),
  languageUsage: LanguageUsageSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ConversationDetailSchema = ConversationSummarySchema.extend({ messages: z.array(TutorMessageSchema) });
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

// [TurnSaved]: evento SSE `saved` → ids reales de los dos mensajes + resumen (título, uso del idioma)
export const TurnSavedSchema = z.object({
  conversation: ConversationSummarySchema,
  userMessage: TutorMessageSchema,
  assistantMessage: TutorMessageSchema,
});
export type TurnSaved = z.infer<typeof TurnSavedSchema>;

// [ChatTurn]: `id` llega con el evento `saved` (sin id = aún no guardado → sin menú de acciones)
export interface ChatTurn {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  editedAt?: string | null;
}

// [toTurn]: mensaje guardado → turno de la UI | Puro
export const toTurn = (m: TutorMessage): ChatTurn => ({ id: m.id, role: m.role, content: m.content, editedAt: m.editedAt });

// [ChatChunk]: unión discriminada por `type` → `switch` exhaustivo en la fachada
export type ChatChunk =
  | { type: 'session'; sessionId: string }
  | { type: 'token'; text: string }
  | { type: 'saved'; saved: TurnSaved }
  | { type: 'done' };

// [toChatChunk]: mensaje SSE genérico (shared/utils/event-source) → trozo del tutor | null = evento ajeno o mal formado | Puro
export function toChatChunk({ type, data }: SseMessage<SseData>): ChatChunk | null {
  if (type === 'session' && typeof data['session_id'] === 'string')
    return { type: 'session', sessionId: data['session_id'] };
  if (type === 'token' && typeof data['text'] === 'string')
    return { type: 'token', text: data['text'] };
  if (type === 'saved') {
    const saved = TurnSavedSchema.safeParse(data); // [Tolerant Reader]: si no encaja, se ignora (el chat sigue funcionando sin acciones)
    return saved.success ? { type: 'saved', saved: saved.data } : null;
  }
  return type === 'done' ? { type: 'done' } : null;
}

// [usagePercent]: 0.456 → 46 | Puro
export const usagePercent = (x: number): number => Math.round(x * 100);

// [parseSseFrames]: texto SSE acumulado → trozos del tutor + resto sin terminar | Puro (DRY: el parser vive en shared/utils/event-source)
export function parseSseFrames(buffer: string): { chunks: ChatChunk[]; rest: string } {
  const { messages, rest } = parseSseText(buffer);
  return { chunks: messages.map(toChatChunk).filter((c): c is ChatChunk => c !== null), rest };
}
