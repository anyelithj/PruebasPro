import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
// [Modelo OwnLlm · Dominio]: redacción, errores marcados y corrección (contrato de /api/ai/own-llm/*) + regla pura para marcar el texto | [Patrón]: Schema-First (Zod) + Value Object | [Principio]: SSOT (tipos derivados de los esquemas) + Type-Safe | [Paradigma]: Funcional (sin Angular, sin HTTP)

export const LEVELS = CEFR_LEVELS; // A1–C2 (packages/shared-schemas); FastAPI es la fuente de verdad del alcance (/scope)
export const WRITING_LANGUAGES = LANGUAGES; // Los 7 idiomas de la plataforma (el modelo propio cubre inglés; el resto, el modelo base)
export type WritingLanguage = (typeof WRITING_LANGUAGES)[number];
export const MAX_TEXT = 2000; // Igual que el DTO de NestJS (MaxLength 2000)

// [Entrada]: validada antes de llamar a la API (Fail Fast) — NestJS y FastAPI vuelven a validar
export const WritingInputSchema = z.object({
  text: z.string().trim().min(3).max(MAX_TEXT),
  language: z.enum(WRITING_LANGUAGES),
  level: z.enum(LEVELS),
});
export type WritingInput = z.infer<typeof WritingInputSchema>;

export const ERROR_TYPES = ['grammar', 'vocabulary', 'spelling', 'punctuation', 'word_order', 'style'] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

// [Hallazgo]: `start`/`end` = índices [start, end) sobre el texto original (los calcula el servidor; null si no los encontró)
export const ErrorFindingSchema = z.object({
  type: z.enum(ERROR_TYPES),
  original: z.string(),
  correction: z.string(),
  explanation_es: z.string(),
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
