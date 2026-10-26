import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { LANGUAGES } from '@aula/shared-schemas';
// [Modelo Polyglot · Dominio · Sprints 10.7/10.8]: temas, conceptos, términos con IPA, tabla comparativa y vistas guardadas — contrato de /api/polyglot/* de NestJS | [Patrón]: Schema-First (Zod) | [Principio]: SSOT + Type-Safe | [Paradigma]: Declarativo

// [Categorías · 2026-10-19]: espejo de POLYGLOT_CATEGORIES (NestJS) → un select por categoría en /poliglota
export const TOPIC_CATEGORIES = ['vocabulary', 'phrases', 'numbers', 'grammar', 'other'] as const;
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export const TopicSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  emoji: z.string().default('🌍'),
  description: z.string().default(''),
  status: z.enum(['draft', 'published']),
  category: z.enum(TOPIC_CATEGORIES).catch('vocabulary'), // `.catch`: valor desconocido o ausente → vocabulario (no rompe la pantalla)
  createdBy: z.string().nullable().default(null),
  concepts: z.number().int().optional(), // Solo en el detalle
});
export type Topic = z.infer<typeof TopicSchema>;

export const ConceptSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  position: z.number().int(),
  kind: z.enum(['word', 'phrase']),
  emoji: z.string().default(''),
  imageUrl: z.string().nullable().default(null),
  imageLicense: z.string().nullable().default(null),
  gloss: z.string().default(''),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const TermSchema = z.object({
  id: z.string(),
  conceptId: z.string().optional(),
  language: z.string().optional(),
  text: z.string(),
  ipa: z.string().default(''),
  ipaUs: z.string().nullable().default(null),
  reviewed: z.boolean(),
  needsNativeReview: z.boolean().default(false),
});
export type Term = z.infer<typeof TermSchema>;

// [TableSchema]: una fila por concepto; por idioma pedido, el término o null (hueco sin escribir)
export const TableSchema = z.object({
  topic: TopicSchema,
  languages: z.array(z.enum(LANGUAGES)),
  rows: z.array(
    z.object({
      concept: ConceptSchema,
      terms: z.record(z.string(), TermSchema.nullable()),
    }),
  ),
});
export type ComparisonTable = z.infer<typeof TableSchema>;
export type TableRow = ComparisonTable['rows'][number];

export const ConceptDetailSchema = ConceptSchema.extend({ terms: z.array(TermSchema) });
export type ConceptDetail = z.infer<typeof ConceptDetailSchema>;

export const ViewSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  name: z.string(),
  languages: z.array(z.string()),
  updatedAt: z.string().optional(),
});
export type View = z.infer<typeof ViewSchema>;

// [Entradas]: mismas reglas que los DTO de NestJS (class-validator)
export const TopicInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  emoji: z.string().trim().max(16).optional(),
  description: z.string().trim().max(600).optional(),
  category: z.enum(TOPIC_CATEGORIES).optional(), // [2026-10-19]: en qué select de /poliglota aparece
});
export type TopicInput = z.infer<typeof TopicInputSchema>;

export const ConceptInputSchema = z
  .object({
    kind: z.enum(['word', 'phrase']).default('word'),
    emoji: z.string().trim().max(16).default(''),
    gloss: z.string().trim().max(160).default(''),
    imageUrl: z.string().trim().url().startsWith('https://').max(400).optional().or(z.literal('')),
    imageLicense: z.string().trim().max(300).optional(),
  })
  // [Regla de licencia]: igual que imageProblem() de NestJS → una imagen exige su licencia
  .refine((c) => !c.imageUrl || !!c.imageLicense?.trim(), { path: ['imageLicense'] });
export type ConceptInput = z.infer<typeof ConceptInputSchema>;

export interface TermInput {
  language: string;
  text: string;
}
