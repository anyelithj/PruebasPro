import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { LANGUAGES } from '@aula/shared-schemas';
// [Modelo Dictionary · core · Sprint 10.3 · RF-136/RF-137]: entrada del diccionario (palabra en su frase: traducción según el contexto, IPA y ejemplos) y palabras marcadas «aprendiendo/aprendido» — contrato de /api/vocabulary/lookup/word y /api/vocabulary/words | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe + DRY (lo usan el popover, Poliglota y Gramática) | [Paradigma]: Funcional

export type Accent = 'uk' | 'us';

// [WordLookupSchema]: fila de la caché `language_lookups` (kind = word) con el resultado de FastAPI /language-tools/word
export const WordLookupSchema = z.object({
  id: z.string().optional(), // Ausente si el LLM no respondió (no se cachea)
  language: z.string(),
  text: z.string(),
  result: z.object({
    word: z.string().default(''),
    lemma: z.string().nullable().default(null),
    translation: z.string().default(''), // Vacía = la IA no respondió (el IPA sí llega)
    ipa: z.string().nullable().default(null),
    ipa_uk: z.string().nullable().default(null),
    ipa_us: z.string().nullable().default(null),
    examples: z.array(z.string()).default([]),
  }),
});
export type WordLookup = z.infer<typeof WordLookupSchema>;

export const WORD_STATUSES = ['learning', 'learned'] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

export const MarkedWordSchema = z.object({
  id: z.string(),
  language: z.string(),
  term: z.string(),
  termKey: z.string().optional(),
  status: z.enum(WORD_STATUSES).nullable(),
});
export type MarkedWord = z.infer<typeof MarkedWordSchema>;

export const WordQuerySchema = z.object({
  language: z.enum(LANGUAGES),
  word: z.string().trim().min(1).max(60),
  sentence: z.string().trim().max(400).optional(),
});
export type WordQuery = z.infer<typeof WordQuerySchema>;

export interface MarkInput {
  language: string;
  word: string;
  translation?: string;
  sentence?: string;
}

// [termKey]: misma normalización que NestJS (`termKeyOf`) → «Water » y «water» son la misma palabra marcada
export const termKey = (term: string): string => term.trim().toLowerCase().replace(/\s+/g, ' ');

// [ipaForAccent]: IPA a mostrar según idioma y acento (inglés: UK o US; resto: única variante) — acepta los nombres del cable (ipa_uk) y de las entidades (ipaUs) | Función pura
export const ipaForAccent = (
  language: string,
  accent: Accent,
  v: { ipa?: string | null; ipaUs?: string | null; ipa_uk?: string | null; ipa_us?: string | null },
): string | null =>
  language === 'en'
    ? ((accent === 'uk' ? (v.ipa_uk ?? v.ipa) : (v.ipa_us ?? v.ipaUs ?? v.ipa)) ?? null)
    : (v.ipa ?? null);

export interface Token {
  text: string;
  word: boolean; // true = palabra pulsable · false = espacio o signo
}

// [segmentWords]: parte el texto en palabras y separadores con `Intl.Segmenter` (también sirve para chino, sin espacios); sin soporte → separa por espacios y signos | Función pura
export function segmentWords(text: string, language: string): Token[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    return [...new Seg(language, { granularity: 'word' }).segment(text)].map((s) => ({
      text: s.segment,
      word: !!s.isWordLike,
    }));
  }
  return text
    .split(/([\p{L}\p{M}'’-]+)/u)
    .filter(Boolean)
    .map((t) => ({ text: t, word: /\p{L}/u.test(t) }));
}
