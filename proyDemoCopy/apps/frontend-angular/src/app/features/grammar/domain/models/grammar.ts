import type { IconName } from '@shared/ui/atoms/icon/icon.component';
import { z } from 'zod';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
// [Modelo Grammar · Dominio · Sprints 10.11/10.12]: fichas, secciones (uso, fórmula, negativa, interrogativa, nota y errores comunes) y ejemplos con IPA UK/US y traducción — contrato de /api/grammar/* de NestJS | [Patrón]: Schema-First (Zod) + Lookup Table (SECTION_META) | [Principio]: SSOT + Type-Safe | [Paradigma]: Declarativo

export const SECTION_TYPES = ['usage', 'formula', 'negative', 'interrogative', 'note', 'common_errors'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

// [SECTION_META]: icono + tono por tipo de sección → el color SIEMPRE va con icono y nombre (WCAG 1.4.1) · tonos de la paleta de marca (globals.css)
export const SECTION_META: Readonly<Record<SectionType, { icon: IconName; tone: string }>> = Object.freeze({
  usage: { icon: 'lightbulb', tone: 'border-tone-brand-line bg-tone-brand-soft text-tone-brand' },
  formula: { icon: 'puzzle', tone: 'border-tone-info-line bg-tone-info-soft text-tone-info' },
  negative: { icon: 'octagon-x', tone: 'border-tone-danger-line bg-tone-danger-soft text-tone-danger' },
  interrogative: { icon: 'circle-help', tone: 'border-tone-warning-line bg-tone-warning-soft text-tone-warning' },
  note: { icon: 'notebook-pen', tone: 'border-border bg-muted text-foreground' },
  common_errors: { icon: 'triangle-alert', tone: 'border-tone-danger-line bg-tone-danger-soft text-tone-danger' },
});

export const ExampleSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  position: z.number().int(),
  text: z.string(),
  ipa: z.string().default(''),
  ipaUs: z.string().nullable().default(null),
  translation: z.string().nullable().default(null),
  reviewed: z.boolean().default(false),
});
export type Example = z.infer<typeof ExampleSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  position: z.number().int(),
  type: z.enum(SECTION_TYPES),
  title: z.string().default(''),
  body: z.string().default(''),
});
export type Section = z.infer<typeof SectionSchema>;

export const GrammarTopicSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().default(''),
  language: z.string().nullable(),
  levels: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published']),
  model: z.string().nullable().default(null),
  createdBy: z.string().nullable().default(null),
});
export type GrammarTopic = z.infer<typeof GrammarTopicSchema>;

export const TopicDetailSchema = GrammarTopicSchema.extend({
  sections: z.array(SectionSchema.extend({ examples: z.array(ExampleSchema) })),
});
export type TopicDetail = z.infer<typeof TopicDetailSchema>;
export type SectionWithExamples = TopicDetail['sections'][number];

// [Entradas]: mismas reglas que los DTO de NestJS
export const TopicInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  language: z.enum(LANGUAGES),
  level: z.enum(CEFR_LEVELS),
  summary: z.string().trim().max(600).optional(),
});
export type TopicInput = z.infer<typeof TopicInputSchema>;

export const SectionInputSchema = z.object({
  type: z.enum(SECTION_TYPES),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(4000).optional(),
});
export type SectionInput = z.infer<typeof SectionInputSchema>;

export interface ExamplePatch {
  text?: string;
  ipa?: string;
  ipaUs?: string;
  translation?: string;
}

export interface TopicFilter {
  language?: string;
  level?: string;
  mine?: boolean;
}
