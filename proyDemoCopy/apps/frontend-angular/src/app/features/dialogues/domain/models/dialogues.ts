import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import type { TranscriptLine } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
// [Modelo Dialogues · Dominio · Sprints 9.11–9.13]: temas, diálogos guionados con nivel estimado/confirmado, turnos con IPA y traducción y conversaciones con el avatar — contrato de /api/dialogues/* de NestJS | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional

export const TopicSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  emoji: z.string().default('💬'),
  description: z.string().default(''),
  language: z.string().nullable().default(null),
  levels: z.array(z.string()).default([]),
  objectives: z.array(z.string()).default([]),
  vocabulary: z.record(z.string(), z.array(z.string())).default({}),
  createdBy: z.string().nullable().default(null),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TurnSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  speaker: z.enum(['A', 'B', 'user', 'avatar']),
  text: z.string(),
  ipa: z.string().default(''),
  ipaUs: z.string().nullable().default(null),
  translation: z.string().nullable().default(null),
  startS: z.number().nullable().default(null),
  endS: z.number().nullable().default(null),
  correction: z.string().nullable().default(null),
  audioKey: z.string().nullable().default(null), // [2026-10-20]: hay grabación de voz guardada para este turno del usuario
});
export type Turn = z.infer<typeof TurnSchema>;

export const LevelEstimateSchema = z.object({
  level: z.string(),
  confidence: z.number(),
  method: z.enum(['measures', 'rubric']),
  indicators: z.record(z.string(), z.number()).default({}),
  explanation: z.string().default(''),
  model: z.string().nullable().default(null),
});
export type LevelEstimate = z.infer<typeof LevelEstimateSchema>;

export const DialogueSchema = z.object({
  id: z.string(),
  title: z.string(),
  topicId: z.string().nullable().default(null),
  language: z.string(),
  speakers: z.array(z.string()).default(['A', 'B']),
  level: z.string().nullable().default(null),
  levelStatus: z.enum(['estimated', 'confirmed']),
  levelEstimate: LevelEstimateSchema.nullable().default(null),
  license: z.object({
    type: z.enum(['public_domain', 'creative_commons', 'own_work', 'permission']),
    holder: z.string(),
    source: z.string(),
    variant: z.string().nullable().optional(),
    confirmed: z.boolean(),
  }),
  audioKey: z.string().nullable().default(null),
  createdBy: z.string(),
});
export type Dialogue = z.infer<typeof DialogueSchema>;
export const DialogueDetailSchema = DialogueSchema.extend({
  turns: z.array(TurnSchema),
  editable: z.boolean().default(false),
  hasAudio: z.boolean().default(false),
});
export type DialogueDetail = z.infer<typeof DialogueDetailSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  language: z.string(),
  level: z.string(),
  status: z.enum(['active', 'ended']),
  userTurns: z.number().int().default(0),
  vocabularyUsed: z.array(z.string()).default([]),
  createdAt: z.string().default(''),
});
export type Session = z.infer<typeof SessionSchema>;
export const SessionDetailSchema = SessionSchema.extend({ turns: z.array(TurnSchema) });
export type SessionDetail = z.infer<typeof SessionDetailSchema>;
export const StartResultSchema = z.object({
  session: SessionSchema,
  topic: TopicSchema,
  turns: z.array(TurnSchema),
});
export type StartResult = z.infer<typeof StartResultSchema>;
export const TurnResultSchema = z.object({
  userTurn: TurnSchema,
  avatarTurn: TurnSchema,
  correction: z.string().nullable(),
  vocabularyUsed: z.array(z.string()),
  ended: z.boolean().default(false), // [2026-10-23]: el usuario se despidió → la sesión ya está cerrada
});
export type TurnResult = z.infer<typeof TurnResultSchema>;

export interface TopicInput {
  title: string;
  language?: string;
  levels?: string[];
  objectives?: string[];
}
export interface DialogueInput {
  title: string;
  topicId?: string;
  language: string;
  speakers?: string[];
  turns: { speaker: 'A' | 'B'; text: string }[];
  license: Dialogue['license'];
}
// [Borrador · 2026-10-19]: respuesta de POST /dialogues/draft (modo URL o IA) → rellena el formulario para revisar
export const DialogueDraftSchema = z.object({
  title: z.string(),
  speakers: z.tuple([z.string(), z.string()]),
  turns: z.array(z.object({ speaker: z.enum(['A', 'B']), text: z.string() })),
  source: z.enum(['script', 'llm']),
  holder: z.string().optional(), // [2026-10-20]: titular que declara la página (modo URL) → la licencia se rellena sola
});
export type DialogueDraft = z.infer<typeof DialogueDraftSchema>;
export interface DraftRequest {
  mode: 'text' | 'ai';
  language: string;
  level?: string;
  topic?: string;
  text?: string;
  title?: string;
  speakers?: string[];
  turns?: number;
}

export interface DialogueFilter {
  language?: string;
  level?: string;
  topic?: string;
  mine?: boolean;
  pending?: boolean;
}

// [toTranscript]: turno → línea del texto sincronizado compartido; `names` traduce A/B/user/avatar al nombre visible | Función pura
export const toTranscript = (
  t: Turn,
  names: Partial<Record<Turn['speaker'], string>>,
): TranscriptLine => ({
  id: t.id,
  text: t.text,
  ipa: t.ipa,
  ipaUs: t.ipaUs,
  translation: t.translation,
  start: t.startS,
  end: t.endS,
  speaker: names[t.speaker] ?? t.speaker,
  note: t.correction,
});

// [similarity]: proporción de palabras de la frase objetivo que aparecen en lo dicho (sin tildes ni mayúsculas) | Función pura — determinista, sin IA
export function similarity(target: string, said: string): number {
  const words = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}'’]+/gu) ?? [];
  const want = words(target);
  if (!want.length) return 0;
  const pool = [...words(said)];
  const hits = want.filter((w) => {
    const k = pool.indexOf(w);
    if (k >= 0) pool.splice(k, 1); // Cada palabra dicha cuenta una sola vez
    return k >= 0;
  }).length;
  return hits / want.length;
}
export const PASS_SIMILARITY = 0.7; // ≥ 70 % de las palabras → turno superado
