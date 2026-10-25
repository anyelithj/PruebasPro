import { z } from 'zod';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { GAME_TYPES } from './game-type';
// [Modelo Games · Dominio · Sprints 8.8–8.11]: sesión, ronda, veredicto, turno del agente, flashcard (SM-2), escenario de role-play, métrica de fluidez y transcripción — contrato de /api/games/* y /api/speech/* de NestJS | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional
// [Numéricos]: las columnas decimal de PostgreSQL llegan como texto → `z.coerce.number()`

export const GameTypeSchema = z.enum(GAME_TYPES);

export const CatalogSchema = z.object({
  games: z.array(
    z.object({
      type: GameTypeSchema,
      family: z.enum(['vocab', 'agent', 'listening', 'oral']),
      skill: z.string(),
      agentGame: z.string().optional(),
      // [2026-10-24]: ajustes de Gestión → Actividades → Juegos (null = texto por defecto del diccionario)
      title: z.string().nullish(),
      description: z.string().nullish(),
      status: z.enum(['published', 'draft', 'archived']).optional(),
    }),
  ),
  license: z.object({ license: z.string(), author: z.string(), source: z.string() }), // [Sprint 8.17]: licencia del contenido de los juegos
});
export type Catalog = z.infer<typeof CatalogSchema>;

const VocabItemSchema = z.object({
  entryId: z.string().optional(),
  term: z.string(),
  translation: z.string().optional(),
  emoji: z.string().optional(),
  category: z.string().optional(),
});
export type VocabItem = z.infer<typeof VocabItemSchema>;
const LineSchema = z.object({
  text: z.string(),
  answer: z.string().optional(),
  gap: z.string().optional(),
  question: z.string().optional(), // [2026-10-19]: pregunta de «respuesta rápida» (se escucha y se ve tras la frase)
});
export type Line = z.infer<typeof LineSchema>;
export const ObjectiveSchema = z.object({
  id: z.string(),
  text: z.string(),
  keywords: z.array(z.string()),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

export const SessionContentSchema = z.object({
  target: z.string().nullable().optional(), // Oculto (null) en 20 preguntas y describe-adivina mientras la partida sigue
  forbidden: z.array(z.string()).optional(),
  topic: z.string().nullable().optional(),
  vocabulary: z.array(VocabItemSchema).default([]),
  role: z.string().nullable().optional(),
  objectives: z.array(ObjectiveSchema).optional(),
  met: z.array(z.string()).optional(), // Objetivos de role-play cumplidos
  lines: z.array(LineSchema).optional(),
  fallback: z.boolean().optional(), // Sin banco propio del idioma → se usa el inglés (se avisa)
});
export type SessionContent = z.infer<typeof SessionContentSchema>;

export const GameSessionSchema = z.object({
  id: z.string(),
  gameType: GameTypeSchema,
  language: z.string(),
  level: z.string().nullable(),
  difficulty: z.number().int(),
  scenarioId: z.string().nullable(),
  content: SessionContentSchema,
  status: z.enum(['active', 'finished', 'cancelled']),
  score: z.number(),
  roundsCount: z.number().int(),
  correctCount: z.number().int(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type GameSession = z.infer<typeof GameSessionSchema>;

export const RoundSchema = z.object({
  id: z.string(),
  index: z.number().int(),
  prompt: z.string().default(''),
  answer: z.string(),
  correct: z.boolean().nullable(), // null = juego abierto (se mide fluidez)
  timeToAnswerMs: z.number().nullable(),
  durationMs: z.number().nullable(),
  wordsProduced: z.number().int(),
  evaluation: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});
export type Round = z.infer<typeof RoundSchema>;

export const FluencyMetricSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  timeToRespondS: z.coerce.number(),
  speakingTimeS: z.coerce.number(),
  pauses: z.coerce.number(),
  longestRunS: z.coerce.number(),
  wordsProduced: z.coerce.number(),
  wordsPerMinute: z.coerce.number(),
  reuseRatio: z.coerce.number(), // 0..1 vocabulario de la sesión reutilizado
  createdAt: z.string(),
});
export type FluencyMetric = z.infer<typeof FluencyMetricSchema>;

export const VerdictSchema = z.object({
  correct: z.boolean().nullable(),
  expected: z.string().optional(),
  overlap: z.number().optional(),
});
export type Verdict = z.infer<typeof VerdictSchema>;
export const SubmitResultSchema = z.object({
  round: RoundSchema,
  verdict: VerdictSchema,
  metric: FluencyMetricSchema.nullable(),
});
export type SubmitResult = z.infer<typeof SubmitResultSchema>;
export const SessionDetailSchema = z.object({
  session: GameSessionSchema,
  rounds: z.array(RoundSchema),
  metrics: z.array(FluencyMetricSchema),
});
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

// [Turno del agente]: respuesta + estado del motor (pista prohibida, adivinó, objetivos cumplidos…)
export const AgentTurnSchema = z.object({
  reply: z.string(),
  state: z.record(z.string(), z.unknown()).default({}),
  round: RoundSchema,
  finished: z.boolean(),
});
export type AgentTurn = z.infer<typeof AgentTurnSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  language: z.string(),
  level: z.string(),
  emoji: z.string().nullable().default('🎭'),
  role: z.string(),
  opening: z.string().nullable().default(''),
  objectives: z.array(ObjectiveSchema),
  vocabulary: z.array(z.string()).default([]),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const DueCardSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  repetitions: z.number().int(),
  intervalDays: z.coerce.number(),
  dueAt: z.string(),
  entry: z.object({
    id: z.string(),
    term: z.string(),
    translation: z.string(),
    language: z.string(),
    example: z.string().nullable().default(null),
  }),
});
export type DueCard = z.infer<typeof DueCardSchema>;

export const WordStampSchema = z.object({ word: z.string(), start: z.number(), end: z.number() });
export type WordStamp = z.infer<typeof WordStampSchema>;
export const TranscriptionSchema = z.object({
  text: z.string(),
  language: z.string(),
  duration: z.number(),
  words: z.array(WordStampSchema),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;

// [Entradas]: mismas reglas que los DTO de NestJS
export const StartInputSchema = z.object({
  gameType: GameTypeSchema,
  language: z.enum(LANGUAGES),
  level: z.enum(CEFR_LEVELS).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  scenarioId: z.string().optional(),
});
export type StartInput = z.infer<typeof StartInputSchema>;
export interface RoundInput {
  answer: string;
  prompt?: string;
  entryIndex?: number;
  lineIndex?: number;
  expected?: 'term' | 'translation' | 'category'; // 'category' = clasificación rápida
  timeToAnswerMs?: number;
  durationMs?: number;
  promptEndS?: number;
  words?: WordStamp[];
}

// ── Reglas puras ──
// [accuracy]: % de aciertos de la sesión (0 si no hubo rondas calificadas)
export const accuracy = (s: Pick<GameSession, 'roundsCount' | 'correctCount'>): number =>
  s.roundsCount ? Math.round((s.correctCount / s.roundsCount) * 100) : 0;
// [maskGap]: dictado parcial → la palabra oculta se sustituye por «_____» (solo la primera aparición)
export const maskGap = (line: Line): string =>
  line.gap
    ? line.text.replace(
        new RegExp(`\\b${line.gap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
        '_____',
      )
    : line.text;
// [shuffle]: Fisher–Yates sin mutar la entrada (memory y bingo) | `rand` inyectable → pruebas deterministas
export const shuffle = <T>(items: readonly T[], rand: () => number = Math.random): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
