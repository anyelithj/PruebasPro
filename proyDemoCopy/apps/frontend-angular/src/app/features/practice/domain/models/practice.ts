import type { IconName } from '@shared/ui/atoms/icon/icon.component';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
// [Modelo Practice · Dominio · Sprints 8.14/8.15]: actividad, ítem (vista del estudiante sin respuestas / vista completa del docente), intento y retroalimentación con errores clasificados — contrato de /api/practice/* de NestJS | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional
// [Contrato por tipo] (igual que FastAPI Grading /grading/practice):
//   multiple_choice / fill_blank → answer[i] = respuesta del hueco i · match_pairs → answer[i] = derecha elegida para la izquierda i (izquierdas = líneas del enunciado)
//   drag_order → answer = fichas en orden · mark_errors → answer = índices de palabra marcados · open_answer → answer[0] = texto libre

export const ITEM_TYPES = [
  'multiple_choice',
  'fill_blank',
  'match_pairs',
  'drag_order',
  'mark_errors',
  'open_answer',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const SKILLS = ['structure', 'grammar', 'vocabulary'] as const; // RF-112: estructura, gramática o vocabulario
export type Skill = (typeof SKILLS)[number];

export const StudentItemSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  itemType: z.enum(ITEM_TYPES),
  skill: z.enum(SKILLS),
  prompt: z.string(),
  options: z.array(z.string()).default([]),
  blanks: z.number().int().optional(), // fill_blank / match_pairs: cuántas respuestas espera
});
export type StudentItem = z.infer<typeof StudentItemSchema>;

// [FullItem]: lo que ve el docente (respuestas aceptadas, correcciones, explicación y consejo)
export const FullItemSchema = StudentItemSchema.extend({
  accepted: z.array(z.array(z.string())),
  corrections: z.record(z.string(), z.string()).default({}),
  explanation: z.string().default(''),
  tip: z.string().default(''),
});
export type FullItem = z.infer<typeof FullItemSchema>;

// [Contenidos vinculados · 2026-10-23]: espejo de CONTENT_KINDS de NestJS (practice/domain/item-type.ts)
export const CONTENT_KINDS = ['vocabulary', 'grammar', 'game', 'music', 'dialogue', 'polyglot', 'resource', 'link'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const CONTENT_ICON: Readonly<Record<ContentKind, IconName>> = Object.freeze({
  vocabulary: 'languages',
  grammar: 'ruler',
  game: 'gamepad-2',
  music: 'music',
  dialogue: 'message-circle',
  polyglot: 'globe',
  resource: 'library',
  link: 'link',
});
export const ActivityContentSchema = z.object({ kind: z.enum(CONTENT_KINDS), label: z.string(), href: z.string() });
export type ActivityContent = z.infer<typeof ActivityContentSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  language: z.string(),
  level: z.string(),
  skill: z.enum(SKILLS),
  status: z.enum(['draft', 'published']),
  aiDraft: z.boolean(), // Nació de un borrador de IA → exige revisión antes de publicar
  contents: z.array(ActivityContentSchema).default([]), // [2026-10-23]: vocabulario, juego, canción… vinculados
  createdBy: z.string(),
  updatedAt: z.string().optional(),
});
export type Activity = z.infer<typeof ActivitySchema>;
// `z.union`: el estudiante recibe ítems sin respuestas; el autor, completos
export const ActivityDetailSchema = ActivitySchema.extend({
  items: z.array(z.union([FullItemSchema, StudentItemSchema])),
});
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;

export const FindingSchema = z.object({
  type: z.string(), // grammar | vocabulary | spelling | punctuation | word_order | style
  original: z.string(),
  correction: z.string(),
  explanation_es: z.string(),
  start: z.number().nullable().optional(),
  end: z.number().nullable().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;
export const FeedbackSchema = z.object({
  correct: z.boolean(),
  score: z.number(),
  findings: z.array(FindingSchema).default([]),
  correct_answer: z.string().default(''),
  explanation: z.string().default(''),
  tip: z.string().default(''),
  method: z.string().default('deterministic'),
});
export type Feedback = z.infer<typeof FeedbackSchema>;
export const AttemptSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  activityId: z.string(),
  answer: z.array(z.string()),
  correct: z.boolean(),
  score: z.coerce.number(),
  feedback: FeedbackSchema,
  createdAt: z.string(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

// ── Entradas (mismas reglas que los DTO de NestJS) ──
export const ItemInputSchema = z.object({
  itemType: z.enum(ITEM_TYPES),
  skill: z.enum(SKILLS),
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(z.string()).default([]),
  accepted: z.array(z.array(z.string()).min(1)).min(1),
  corrections: z.record(z.string(), z.string()).optional(),
  explanation: z.string().max(600).default(''),
  tip: z.string().max(400).default(''),
});
export type ItemInput = z.infer<typeof ItemInputSchema>;
export const ActivityInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(2000).default(''),
  language: z.enum(LANGUAGES),
  level: z.enum(CEFR_LEVELS),
  skill: z.enum(SKILLS),
});
export type ActivityInput = z.infer<typeof ActivityInputSchema>;
export const DraftInputSchema = z.object({
  language: z.enum(LANGUAGES),
  level: z.enum(CEFR_LEVELS),
  skill: z.enum(SKILLS),
  topic: z.string().trim().min(2).max(160),
  itemTypes: z.array(z.enum(ITEM_TYPES)).min(1),
  count: z.number().int().min(1).max(10),
  sourceText: z.string().max(20000).optional(), // [2026-10-23]: texto de un PDF, imagen o enlace subido por el docente
});
export type DraftInput = z.infer<typeof DraftInputSchema>;
export const DraftSchema = z.object({
  items: z.array(ItemInputSchema.extend({ skill: z.enum(SKILLS) })),
  model: z.string(),
  discarded: z.number().int().default(0),
});
export type Draft = z.infer<typeof DraftSchema>;
export interface ActivityFilter {
  language?: string;
  level?: string;
  skill?: string;
  mine?: boolean;
}

// ── Reglas puras ──
export const isFull = (i: StudentItem | FullItem): i is FullItem => 'accepted' in i; // Type guard (TS)
// [words]: palabras del texto de mark_errors (el índice es la posición) | `split(/\s+/)` igual que NestJS y FastAPI
export const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);
// [blanksOf]: huecos «___» del enunciado (fill_blank) → texto partido para pintar campos entre trozos
export const blanksOf = (prompt: string): string[] => prompt.split(/_{3,}/);
// [leftItems]: emparejar → cada línea del enunciado es un elemento de la izquierda
export const leftItems = (prompt: string): string[] =>
  prompt
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
// [itemProblem]: espejo de la Specification de NestJS (item-rules.ts) → el constructor avisa antes de enviar
export function itemProblem(
  i: Pick<ItemInput, 'itemType' | 'prompt' | 'options' | 'accepted'>,
): string | null {
  if (!i.accepted.length || i.accepted.some((a) => !a.length || a.every((x) => !x.trim())))
    return 'Cada respuesta necesita al menos una variante aceptada';
  switch (i.itemType) {
    case 'multiple_choice':
      return i.options.length < 2
        ? 'Opción múltiple necesita al menos dos opciones'
        : i.accepted.flat().every((a) => i.options.includes(a))
          ? null
          : 'La respuesta correcta debe ser una de las opciones';
    case 'drag_order':
      return i.accepted.every((o) => [...o].sort().join('|') === [...i.options].sort().join('|'))
        ? null
        : 'Cada orden aceptado debe usar exactamente las mismas fichas';
    case 'match_pairs':
      return i.options.length >= 2 ? null : 'Emparejar necesita al menos dos opciones a la derecha';
    case 'mark_errors': {
      const n = words(i.prompt).length;
      return i.accepted[0].every((x) => /^\d+$/.test(x) && Number(x) < n)
        ? null
        : 'Los errores deben ser índices de palabra del texto';
    }
    default:
      return null;
  }
}
