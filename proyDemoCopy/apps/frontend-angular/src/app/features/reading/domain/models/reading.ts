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
  // [2026-10-28]: frases sin traducción/IPA y si NestJS las está generando en segundo plano → el lector vuelve a consultar hasta completarlas
  pending: z.number().int().default(0),
  enriching: z.boolean().default(false),
});
export type ReadingDetail = z.infer<typeof ReadingDetailSchema>;

export interface ReadingFilter {
  language?: string;
  level?: string;
  genre?: string;
  kind?: 'reading' | 'dictation'; // [2026-11-16]: sin kind → lecturas
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
// [Fix 2026-11-02 · resaltado adelantado]: la voz PARA en comas y puntos → esa pausa cuenta como tiempo de la palabra anterior (antes el resaltado corría por delante tras cada coma)
const PAUSE = /[,;:—–]/;
const STOP = /[.!?…]/;
export function wordAtProgress(tokens: readonly Token[], progress: number): number {
  const words = tokens.filter((t) => t.word >= 0);
  if (!words.length) return -1;
  // Peso de cada palabra = letras + 1 (hueco) + pausa del signo que la sigue
  const weights = new Map<number, number>();
  let last = -1;
  for (const t of tokens) {
    if (t.word >= 0) weights.set((last = t.word), t.text.length + 1);
    else if (last >= 0) weights.set(last, weights.get(last)! + (STOP.test(t.text) ? 6 : PAUSE.test(t.text) ? 4 : 0));
  }
  const total = words.reduce((n, t) => n + weights.get(t.word)!, 0);
  let acc = 0;
  const target = Math.min(Math.max(progress, 0), 1) * total;
  for (const t of words) {
    acc += weights.get(t.word)!;
    if (target < acc) return t.word;
  }
  return words[words.length - 1]!.word;
}

// [estimateMs]: duración estimada de la frase cuando no hay audio ni eventos (por defecto ≈ 14 caracteres por segundo a 1x; `cps` = velocidad medida de la voz real) | Función pura
export const estimateMs = (sentence: string, rate = 1, cps = 14): number => Math.max(800, (sentence.length / cps) * 1000) / Math.max(rate, 0.25);

// [readingMinutes]: minutos de lectura con 120 palabras por minuto (aprendiz) | mínimo 1
export const readingMinutes = (words: number): number => Math.max(1, Math.round(words / 120));

// [mergeLinguistics · 2026-10-28]: traducción/IPA recién generadas (refresco en segundo plano) sobre las frases actuales, alineadas por `position` | Función pura
// Solo rellena: nunca borra un dato que ya estaba (un refresco parcial no vacía la columna derecha)
export function mergeLinguistics<T extends Pick<ReadingSentence, 'position' | 'translation' | 'ipa' | 'ipaUs'>>(current: readonly T[], fresh: readonly T[]): T[] {
  const byPosition = new Map(fresh.map((s) => [s.position, s])); // `Map` (ES2015): búsqueda O(1) por índice de frase
  return current.map((s) => {
    const f = byPosition.get(s.position);
    return f ? { ...s, translation: f.translation ?? s.translation, ipa: f.ipa || s.ipa, ipaUs: f.ipaUs ?? s.ipaUs } : s;
  });
}

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

// [wordIpa · 2026-11-06]: IPA debajo de CADA palabra (antes por cláusula → unas frases partidas en renglones y otras no)
// La IPA es de la frase entera y espeak-ng une palabras («there was» → «ðeəwˌɒz») → alineación por programación dinámica: pasos 1:1, 2:1, 3:1 y 1:2
// con coste = diferencia de longitud (en letras) + castigo a lo que no es 1:1 | Resultado: un trozo por palabra (índice = Token.word); vacío si espeak la unió con la anterior | Función pura
// ponytail: heurística por longitudes; IPA por palabra guardada en la BD si se ve algún desplazamiento
const letters = (s: string): number => Math.max(1, s.match(/[\p{Ll}\p{Lu}\p{Lo}]/gu)?.length ?? 0); // Sin \p{Lm}: «ˈ ˌ ː» no son sonidos
const STEPS: ReadonlyArray<readonly [number, number, number]> = [[1, 1, 0], [2, 1, 0.6], [3, 1, 1.2], [1, 2, 0.6]]; // [palabras de texto, palabras IPA, castigo]
export function wordIpa(tokens: readonly Token[], ipa: string): string[] {
  const words = tokens.filter((t) => t.word >= 0).map((t) => letters(t.text));
  const ipaWords = ipa.replace(/^\/|\/$/g, '').trim().split(/\s+/).filter(Boolean);
  const out: string[] = words.map(() => '');
  const [n, m] = [words.length, ipaWords.length];
  if (!n || !m) return out;
  const il = ipaWords.map(letters);
  // cost[i][j]: mejor coste alineando i palabras de texto con j palabras IPA | back: paso elegido
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const back = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(-1));
  cost[0]![0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      if (cost[i]![j] === Infinity) continue;
      STEPS.forEach(([a, b, pen], k) => {
        if (i + a > n || j + b > m) return;
        const t = words.slice(i, i + a).reduce((x, y) => x + y, 0);
        const p = il.slice(j, j + b).reduce((x, y) => x + y, 0);
        const c = cost[i]![j]! + Math.abs(Math.log(p / t)) + pen;
        if (c < cost[i + a]![j + b]!) [cost[i + a]![j + b], back[i + a]![j + b]] = [c, k];
      });
    }
  if (back[n]![m] === -1) return [ipaWords.join(' '), ...out.slice(1)]; // Sin alineación posible: toda la IPA en la primera palabra
  for (let [i, j] = [n, m]; i > 0; ) {
    const [a, b] = STEPS[back[i]![j]!]!;
    [i, j] = [i - a, j - b];
    out[i] = ipaWords.slice(j, j + b).join(' ');
  }
  return out;
}
