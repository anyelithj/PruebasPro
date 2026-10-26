import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace → esbuild empaqueta solo lo usado
import { READING_GENRES } from '@aula/shared-schemas';
// [Modelo Reading · Dominio · Lectura · 2026-10-25]: contrato de /api/reading/texts/* de NestJS + funciones PURAS del lector (palabras con su posición, palabra activa por carácter o por tiempo estimado, IPA palabra a palabra, minutos de lectura)
// [Patrón]: Schema-First (Zod) + Pure Functions | [Principio]: SSOT (géneros de @aula/shared-schemas) + Type-Safe + testeable sin Angular | [Paradigma]: Funcional

export const ReadingGenreSchema = z.enum(READING_GENRES);
export type ReadingGenre = z.infer<typeof ReadingGenreSchema>;

export const ReadingSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  language: z.string(),
  level: z.string(),
  genre: ReadingGenreSchema,
  topic: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
  status: z.enum(['draft', 'published']).default('draft'),
  sourceRef: z.string().nullable().default(null),
  sentenceCount: z.number().int().default(0),
  wordCount: z.number().int().default(0),
});
export type ReadingSummary = z.infer<typeof ReadingSummarySchema>;

export const ReadingSentenceSchema = z.object({
  id: z.string(),
  paragraph: z.number().int(),
  position: z.number().int(),
  text: z.string(),
  translation: z.string().nullable().default(null),
  ipa: z.string().default(''),
  ipaUs: z.string().nullable().default(null),
});
export type ReadingSentence = z.infer<typeof ReadingSentenceSchema>;

export const ReadingProgressSchema = z.object({
  sentence: z.number().int(),
  word: z.number().int().default(0),
  finished: z.boolean().default(false),
});
export type ReadingProgress = z.infer<typeof ReadingProgressSchema>;

export const ReadingDetailSchema = ReadingSummarySchema.extend({
  sentences: z.array(ReadingSentenceSchema).default([]),
  editable: z.boolean().default(false),
  progress: ReadingProgressSchema.nullable().default(null),
});
export type ReadingDetail = z.infer<typeof ReadingDetailSchema>;

export interface ReadingFilter {
  language?: string;
  level?: string;
  genre?: string;
}

// ─── Lector: palabras y sincronía ────────────────────────────────────────────

// [Token]: trozo de la frase — palabra (resaltable y con IPA) o separador (espacios y signos) con su posición en caracteres
export interface Token {
  readonly text: string;
  readonly start: number; // Índice del primer carácter en la frase
  readonly end: number; // Índice tras el último carácter
  readonly word: number; // Índice de palabra (0…) o -1 si es separador
}

// [WORD]: letras/números con apóstrofos y guiones internos («don't», «bien-être») · en chino cada carácter Han es una «palabra» | `u` (Unicode, ES2018)
const WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}'’-]*[\p{L}\p{N}\p{M}])?/gu;
const HAN = /\p{Script=Han}/gu;

// [tokenize]: frase → palabras y separadores en orden (la concatenación de `text` es la frase original) | Función pura
export function tokenize(sentence: string, language = 'en'): Token[] {
  const re = new RegExp(language === 'zh' ? HAN.source : WORD.source, 'gu'); // Copia: `lastIndex` propio en cada llamada
  const out: Token[] = [];
  let cursor = 0;
  let word = 0;
  for (const m of sentence.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > cursor) out.push({ text: sentence.slice(cursor, start), start: cursor, end: start, word: -1 });
    out.push({ text: m[0], start, end: start + m[0].length, word: word++ });
    cursor = start + m[0].length;
  }
  if (cursor < sentence.length) out.push({ text: sentence.slice(cursor), start: cursor, end: sentence.length, word: -1 });
  return out;
}

export const wordCount = (tokens: readonly Token[]): number => tokens.filter((t) => t.word >= 0).length;

// [wordAtChar]: palabra que contiene (o sigue a) el carácter `charIndex` — evento `boundary` de la voz del navegador | -1 si no hay palabras
export function wordAtChar(tokens: readonly Token[], charIndex: number): number {
  const words = tokens.filter((t) => t.word >= 0);
  if (!words.length) return -1;
  const hit = words.find((t) => charIndex < t.end);
  return (hit ?? words[words.length - 1]!).word;
}

// [wordAtProgress]: palabra que suena con un avance 0–1 de la frase, repartiendo el tiempo según LETRAS (una palabra larga dura más que «a») | Función pura
// [Estimación]: el audio del servidor (espeak-ng) no da tiempos por palabra → el avance real del <audio> (currentTime/duration) se convierte en palabra
export function wordAtProgress(tokens: readonly Token[], progress: number): number {
  const words = tokens.filter((t) => t.word >= 0);
  if (!words.length) return -1;
  const weight = (t: Token) => t.text.length + 1; // +1: la pausa entre palabras
  const total = words.reduce((n, t) => n + weight(t), 0);
  let acc = 0;
  const target = Math.min(Math.max(progress, 0), 1) * total;
  for (const t of words) {
    acc += weight(t);
    if (target < acc) return t.word;
  }
  return words[words.length - 1]!.word;
}

// [estimateMs]: duración estimada de la frase cuando no hay audio ni eventos (≈ 14 caracteres por segundo a 1x) | Función pura
export const estimateMs = (sentence: string, rate = 1): number => Math.max(800, (sentence.length / 14) * 1000) / Math.max(rate, 0.25);

// [ipaWords]: IPA de la frase repartida palabra a palabra si coinciden los recuentos (espeak separa palabras con espacio); si no, null → se muestra la IPA de la frase
export function ipaWords(ipa: string | null | undefined, tokens: readonly Token[]): string[] | null {
  const parts = (ipa ?? '').replace(/[/[\]]/g, '').trim().split(/\s+/).filter(Boolean);
  return parts.length && parts.length === wordCount(tokens) ? parts : null;
}

// [readingMinutes]: minutos de lectura con 120 palabras por minuto (aprendiz) | mínimo 1
export const readingMinutes = (words: number): number => Math.max(1, Math.round(words / 120));

// [paragraphs]: frases agrupadas por párrafo en orden (para pintar <p>) | Función pura
export function paragraphs<T extends { paragraph: number }>(sentences: readonly T[]): T[][] {
  const out: T[][] = [];
  let last = Number.NaN;
  for (const s of sentences) {
    if (s.paragraph !== last) out.push([]);
    out[out.length - 1]!.push(s);
    last = s.paragraph;
  }
  return out;
}
