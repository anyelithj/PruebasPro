import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { LANGUAGES } from '@aula/shared-schemas';
// [Modelo Vocabulary · Dominio · Sprint 8.3]: consulta de traducción e IPA (LanguageLookup) y entrada del banco de vocabulario (VocabularyEntry) — contrato de /api/vocabulary/* de NestJS | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional
// [Tolerancia]: la traducción la hace un LLM local → puede faltar (`model: "unavailable"`); el IPA (espeak-ng) es determinista y siempre llega

export const VOCAB_LANGUAGES = LANGUAGES; // [SSOT]: mismos códigos que el enum Language de NestJS (packages/shared-schemas)
export type VocabLanguage = (typeof VOCAB_LANGUAGES)[number];
// [Detectar idioma · 2026-10-27]: opción por defecto del idioma de origen del Traductor (FastAPI detecta y responde `detected_language`)
export const AUTO = 'auto' as const;
export type SourceLanguage = VocabLanguage | typeof AUTO;

// [TranslateResult]: respuesta de POST /vocabulary/lookup/translate | `detected` = idioma detectado (solo con source «auto»; null si no)
export const TEXT_KINDS = ['frase', 'titulo', 'expresion'] as const; // [2026-11-13 · Caso C]: mismo «tipo_de_texto» que el Anexo A
export type TextKind = (typeof TEXT_KINDS)[number];
export const TranslateResultSchema = z
  .object({
    translation: z.string(),
    detected_language: z.enum(VOCAB_LANGUAGES).nullish(),
    // [Caso C]: títulos/expresiones → natural (recomendada), cercana y literal · vacío en «frase»
    options: z.array(z.object({ tipo: z.enum(['natural', 'cercana', 'literal']), texto: z.string() })).default([]),
  })
  .transform((r) => ({ translation: r.translation, detected: r.detected_language ?? null, options: r.options })); // `.transform` (Zod): snake_case del cable → modelo de dominio
export type TranslateResult = z.infer<typeof TranslateResultSchema>;
// [DetectResult · 2026-10-30]: respuesta de POST /vocabulary/lookup/detect | Zod valida el contrato en la frontera
export const DetectResultSchema = z.object({ language: z.enum(VOCAB_LANGUAGES) });
export type DetectResult = z.infer<typeof DetectResultSchema>;

const TranslationSchema = z.object({
  translation: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  model: z.string().default(''), // «unavailable» = la IA no respondió (se muestra aviso, no error)
});

// [LookupSchema]: fila de la caché `language_lookups` con el resultado de FastAPI LanguageTools
export const LookupSchema = z.object({
  // [Fix 2026-10-27]: con el LLM caído NestJS devuelve la IPA SIN guardar la fila (no cachea fallos) → llega sin `id`; antes Zod lo rechazaba
  // y la ficha perdía también la IPA (que sí venía) | `.default('')` (Zod): resultado válido pero no consultable por id
  id: z.string().default(''),
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

// [GrammarSchema · 2026-11-03 · Regla obligatoria]: artículo/género/plural/clasificador del sustantivo + texto de tarjeta («der Tisch – die Tische») + lo que falta
export const GrammarSchema = z.object({
  is_noun: z.boolean(),
  gender: z.enum(['m', 'f', 'n']).nullable().optional(),
  article: z.string().nullable().optional(),
  plural: z.string().nullable().optional(),
  countable: z.boolean().nullable().optional(),
  pinyin: z.string().nullable().optional(),
  classifier: z.string().nullable().optional(),
  headword: z.string(),
  missing: z.array(z.string()).default([]),
  checked: z.boolean().default(true),
});
export type Grammar = z.infer<typeof GrammarSchema>;
// [headword]: lo que se estudia (sustantivo con su artículo/plural/clasificador) o el término tal cual | función pura
export const headwordOf = (e: { term: string; grammar?: Grammar | null }): string => e.grammar?.headword || e.term;
// [grammarPending]: null (aún sin revisar), IA caída o faltan datos obligatorios → la UI avisa «Incompleta»
export const grammarPending = (g: Grammar | null | undefined): boolean => !g || !g.checked || g.missing.length > 0;
const GENDER_ES = { m: 'masculino', f: 'femenino', n: 'neutro' } as const;
export const genderLabel = (g: Grammar | null | undefined): string => (g?.gender ? GENDER_ES[g.gender] : '');

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
  grammar: GrammarSchema.nullable().default(null),
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
