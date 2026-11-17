import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
// [Modelo OwnLlm · Dominio]: redacción, errores marcados y corrección (contrato de /api/ai/own-llm/*) + regla pura para marcar el texto | [Patrón]: Schema-First (Zod) + Value Object | [Principio]: SSOT (tipos derivados de los esquemas) + Type-Safe | [Paradigma]: Funcional (sin Angular, sin HTTP)

export const LEVELS = CEFR_LEVELS; // A1–C2 (packages/shared-schemas); FastAPI es la fuente de verdad del alcance (/scope)
export const WRITING_LANGUAGES = LANGUAGES; // Los 7 idiomas de la plataforma (el modelo propio cubre inglés; el resto, el modelo base)
export type WritingLanguage = (typeof WRITING_LANGUAGES)[number];
export const MAX_TEXT = 2000; // Igual que el DTO de NestJS (MaxLength 2000)
// [Detectar idioma · 2026-10-27]: opción por defecto (como GrammarMama) → FastAPI detecta el idioma y lo devuelve en `detected_language`
export const AUTO = 'auto' as const;
export type WritingLanguageOrAuto = WritingLanguage | typeof AUTO;

// [Entrada]: validada antes de llamar a la API (Fail Fast) — NestJS y FastAPI vuelven a validar
export const WritingInputSchema = z.object({
  text: z.string().trim().min(3).max(MAX_TEXT),
  language: z.enum([...WRITING_LANGUAGES, AUTO]), // `[...tupla, 'auto']`: los 7 idiomas + «Detectar idioma»
  level: z.enum(LEVELS),
  context: z.string().max(400).optional(), // [2026-11-11]: pregunta del avatar a la que responde (diálogos)
});
export type WritingInput = z.infer<typeof WritingInputSchema>;

// [2026-10-28 · Estilo GrammarMama]: + «capitalization» (Mayúsculas) · el orden es el de la leyenda: Ortografía, Mayúsculas, Gramática, Puntuación, Vocabulario, Orden, Estilo
export const ERROR_TYPES = ['spelling', 'capitalization', 'grammar', 'punctuation', 'vocabulary', 'word_order', 'style', 'article', 'transcription'] as const; // [2026-11-02]: + «Artículo» · [2026-11-13]: + «Posible error de dictado» (Anexo A)
export type ErrorType = (typeof ERROR_TYPES)[number];

// [Hallazgo]: `start`/`end` = índices [start, end) sobre el texto original (los calcula el servidor; null si no los encontró)
export const ErrorFindingSchema = z.object({
  type: z.enum(ERROR_TYPES).catch('grammar'), // `.catch` (Zod 4): una categoría nueva del servidor no tumba la corrección entera → «Gramática»
  original: z.string(),
  correction: z.string(),
  explanation_es: z.string(), // SIEMPRE en español (FastAPI lo garantiza)
  start: z.number().int().nonnegative().nullable(),
  end: z.number().int().nonnegative().nullable(),
});
export type ErrorFinding = z.infer<typeof ErrorFindingSchema>;

export const WritingCorrectionSchema = z.object({
  findings: z.array(ErrorFindingSchema),
  corrected_text: z.string(),
  explanation_es: z.string(),
  model_used: z.string(),
  fallback_used: z.boolean(),
  latency_ms: z.number(),
  flags: z.array(z.string()),
  language: z.string().optional(), // [2026-10-27]: idioma con el que se corrigió (el detectado si se pidió «auto»)
  detected_language: z.string().nullish(), // `nullish()` (Zod): null o ausente (respuestas antiguas)
});
export type WritingCorrection = z.infer<typeof WritingCorrectionSchema>;

export const WritingScopeSchema = z.object({
  languages: z.array(z.string()),
  levels: z.array(z.string()),
  max_text_length: z.number(),
});
export type WritingScope = z.infer<typeof WritingScopeSchema>;

// [Segmento]: trozo del texto original; `finding` = índice del hallazgo si está marcado
export interface TextSegment {
  text: string;
  finding: number | null;
}

// [segmentText]: corta el texto en tramos normales y marcados | ignora hallazgos sin posición, fuera de rango o solapados (el primero gana)
// [Paradigma]: Funcional (pura, sin efectos) → se prueba sin Angular
export function segmentText(text: string, findings: readonly ErrorFinding[]): TextSegment[] {
  const marks = findings
    .map((f, i) => ({ start: f.start, end: f.end, i }))
    .filter((m): m is { start: number; end: number; i: number } => m.start !== null && m.end !== null && m.start < m.end && m.end <= text.length)
    .sort((a, b) => a.start - b.start);
  const out: TextSegment[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start < cursor) continue; // Solapado con el anterior
    if (m.start > cursor) out.push({ text: text.slice(cursor, m.start), finding: null });
    out.push({ text: text.slice(m.start, m.end), finding: m.i });
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), finding: null });
  return out;
}

// [countWords]: palabras separadas por espacios (contador del editor)
export const countWords = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

// ───────────────────────── [Revisión estilo GrammarMama · 2026-10-27] ─────────────────────────
// [Review]: texto en el editor + sugerencias pendientes (con posición válida, sin solapes, en orden) | aceptar reescribe el texto
// y desplaza las posiciones de las siguientes; ignorar solo quita la sugerencia | [Patrón]: Immutable State + Reducer (funciones puras)
export interface Review {
  readonly text: string;
  readonly findings: readonly ErrorFinding[];
}

type Positioned = ErrorFinding & { start: number; end: number };
const positioned = (f: ErrorFinding, len: number): f is Positioned => f.start !== null && f.end !== null && f.start < f.end && f.end <= len;

// [startReview]: descarta hallazgos sin posición, fuera de rango o solapados (el primero gana) → las marcas y «Aceptar» siempre cuadran
export function startReview(text: string, findings: readonly ErrorFinding[]): Review {
  const sorted = findings.filter((f) => positioned(f, text.length)).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const kept: ErrorFinding[] = [];
  for (const f of sorted) if (!kept.length || (f.start ?? 0) >= (kept.at(-1)!.end ?? 0)) kept.push(f); // `Array.at(-1)` (ES2022): último
  return { text, findings: kept };
}

// [acceptFinding]: aplica la sugerencia `i`; si borra una palabra, se lleva un espacio contiguo («I very like» → «I like»)
export function acceptFinding(review: Review, i: number): Review {
  const f = review.findings[i];
  if (!f || !positioned(f, review.text.length)) return review;
  let { start, end } = f;
  const { text } = review;
  if (!f.correction) {
    if (text[end] === ' ') end += 1;
    else if (text[start - 1] === ' ') start -= 1;
  }
  const delta = f.correction.length - (end - start);
  const findings = review.findings
    .filter((_, k) => k !== i)
    .map((g) => ((g.start ?? 0) >= f.end ? { ...g, start: (g.start ?? 0) + delta, end: (g.end ?? 0) + delta } : g)); // `...` (spread): copia inmutable
  return { text: text.slice(0, start) + f.correction + text.slice(end), findings };
}

export const ignoreFinding = (review: Review, i: number): Review => ({ ...review, findings: review.findings.filter((_, k) => k !== i) });

// [acceptAll]: aplica de la última a la primera → las posiciones pendientes nunca se desplazan
export function acceptAll(review: Review): Review {
  let r = review;
  for (let i = r.findings.length - 1; i >= 0; i--) r = acceptFinding(r, i);
  return r;
}

// [countByType]: contador por tipo (leyenda de colores con cifras) | `Partial<Record<…>>` (TS): solo los tipos presentes
export function countByType(findings: readonly ErrorFinding[]): Partial<Record<ErrorType, number>> {
  const out: Partial<Record<ErrorType, number>> = {};
  for (const f of findings) out[f.type] = (out[f.type] ?? 0) + 1;
  return out;
}

// ───── [Corrector pedagógico ÚNICO · Anexo A · 2026-11-13]: espejo de corrector_io.py (FastAPI) ─────
// El MISMO JSON alimenta la revisión previa al envío, la puntuación del turno y la frase a la que responde el avatar | [Principio]: SSOT
export const ANNEX_CATEGORIES = ['ortografia', 'mayuscula', 'puntuacion', 'gramatica', 'vocabulario', 'no_responde_a_la_pregunta', 'posible_error_de_transcripcion'] as const;
export type AnnexCategory = (typeof ANNEX_CATEGORIES)[number];

export const SentenceCorrectionSchema = z.object({
  frase_corregida: z.string(),
  veredicto: z.enum(['correcta', 'con_errores', 'no_responde']),
  errores: z.array(
    z.object({
      categoria: z.enum(ANNEX_CATEGORIES).catch('gramatica'), // `.catch` (Zod 4): categoría nueva del servidor → «Gramática» sin romper la vista
      original: z.string(),
      sugerencia: z.string(),
      explicacion: z.string(),
    }),
  ),
  traduccion: z.string().default(''),
  alternativas_traduccion: z.array(z.object({ tipo: z.enum(['literal', 'natural', 'cercana']), texto: z.string() })).default([]),
  comentario: z.string().default(''),
});
export type SentenceCorrection = z.infer<typeof SentenceCorrectionSchema>;

// [Resultado]: corrección + puntuación (100 solo si «correcta») + trazabilidad (modelo, versión del prompt)
export const CorrectorResultSchema = z.object({
  correccion: SentenceCorrectionSchema,
  puntuacion: z.number().int().min(0).max(100),
  modelo: z.string(),
  respaldo: z.boolean(),
  version_prompt: z.string(),
  latencia_ms: z.number(),
});
export type CorrectorResult = z.infer<typeof CorrectorResultSchema>;

export interface CorrectorInput {
  pregunta_previa?: string;
  texto: string;
  idioma: string;
  nivel: string;
  tema?: string;
  tipo_de_texto?: 'frase' | 'titulo' | 'expresion';
  origen?: 'voz' | 'escrito';
}
