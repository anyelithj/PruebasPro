import { z } from 'zod';
import { LANGUAGES } from '@aula/shared-schemas';
// [Modelo Vocabulary · Dominio · Sprint 8.3]: consulta de traducción e IPA (LanguageLookup) y entrada del banco de vocabulario (VocabularyEntry) — contrato de /api/vocabulary/* de NestJS | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional
// [Tolerancia]: la traducción la hace un LLM local → puede faltar (`model: "unavailable"`); el IPA (espeak-ng) es determinista y siempre llega

export const VOCAB_LANGUAGES = LANGUAGES; // [SSOT]: mismos códigos que el enum Language de NestJS (packages/shared-schemas)
export type VocabLanguage = (typeof VOCAB_LANGUAGES)[number];

const TranslationSchema = z.object({
  translation: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  model: z.string().default(''), // «unavailable» = la IA no respondió (se muestra aviso, no error)
});

// [LookupSchema]: fila de la caché `language_lookups` con el resultado de FastAPI LanguageTools
export const LookupSchema = z.object({
  id: z.string(),
  kind: z.enum(['term', 'word']),
  language: z.string(),
  text: z.string(),
  result: z.object({
    ipa: z.string().nullable().default(null), // Idiomas distintos del inglés (una variante)
    ipa_uk: z.string().nullable().default(null),
    ipa_us: z.string().nullable().default(null),
    engine: z.string().default(''),
    translation: TranslationSchema.default({ translation: '', alternatives: [], model: '' }),
  }),
  hits: z.number().int().default(0), // Veces que la caché evitó llamar a la IA
});
export type Lookup = z.infer<typeof LookupSchema>; // `z.infer` (Zod): tipo derivado del esquema (DRY)

export const VocabularyEntrySchema = z.object({
  id: z.string(),
  language: z.string(),
  term: z.string(),
  translation: z.string(),
  alternatives: z.array(z.string()).default([]),
  ipaUk: z.string().nullable(),
  ipaUs: z.string().nullable(),
  ipa: z.string().nullable(),
  example: z.string().nullable(),
  sourceItemId: z.string().nullable().default(null),
  reviewed: z.boolean(), // false = IPA/traducción automáticos · true = corregido a mano
  createdAt: z.string(),
});
export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>;

// [Entradas]: mismas reglas que los DTO de NestJS (class-validator) → el botón se habilita solo con datos válidos
export const LookupInputSchema = z.object({
  language: z.enum(VOCAB_LANGUAGES),
  text: z.string().trim().min(1).max(500),
});
export type LookupInput = z.infer<typeof LookupInputSchema>;
export const EntryInputSchema = z.object({
  language: z.enum(VOCAB_LANGUAGES),
  term: z.string().trim().min(1).max(160),
  example: z.string().trim().max(600).optional(),
});
export type EntryInput = z.infer<typeof EntryInputSchema>;
// [EntryFormSchema]: modelo del formulario de alta (Signal Forms necesita campos no opcionales → ejemplo vacío = sin ejemplo)
export const EntryFormSchema = EntryInputSchema.extend({ example: z.string().trim().max(600) });
export type EntryForm = z.infer<typeof EntryFormSchema>;
export const EntryPatchSchema = z.object({
  translation: z.string().trim().max(300).optional(),
  ipaUk: z.string().trim().max(300).optional(),
  ipaUs: z.string().trim().max(300).optional(),
  ipa: z.string().trim().max(300).optional(),
  example: z.string().trim().max(600).optional(),
});
export type EntryPatch = z.infer<typeof EntryPatchSchema>;
export interface EntryFilter {
  language?: string;
  q?: string;
}

// [ipaFor]: IPA a mostrar según idioma y acento (inglés: UK o US; resto: única variante) | [Paradigma]: función pura → la usan traductor, banco y <aula-ipa-text>
export const ipaFor = (
  language: string,
  accent: 'uk' | 'us',
  v: {
    ipa?: string | null;
    ipaUk?: string | null;
    ipaUs?: string | null;
    ipa_uk?: string | null;
    ipa_us?: string | null;
  },
): string | null =>
  language === 'en'
    ? ((accent === 'uk' ? (v.ipaUk ?? v.ipa_uk) : (v.ipaUs ?? v.ipa_us)) ?? null)
    : (v.ipa ?? null);
