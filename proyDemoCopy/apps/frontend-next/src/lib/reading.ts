import { READING_GENRES, type ReadingGenre } from "@aula/shared-schemas";
// [lib/reading · Lectura · 2026-10-25]: tipos y funciones PURAS de la sección Lectura en Next.js — géneros con etiqueta, longitudes, texto importado → párrafos y forma de las respuestas de NestJS
// Lo usan la estrategia «Lectura» de Crear actividad (lib/activity-kinds), el editor de Gestión (/admin/activities/lectura/[id]) y sus Server Actions
// [Patrón]: Lookup Table + Pure Functions + DTO (tipos de respuesta) | [Principio]: SSOT (géneros de @aula/shared-schemas) + DRY + SRP | [Paradigma]: Funcional (sin DOM ni red → se prueba con Jest)

export type { ReadingGenre };

// [READING_GENRE_LABEL]: `Record<ReadingGenre, string>` (TS) exhaustivo → un género nuevo en shared-schemas rompe la compilación hasta tener etiqueta
export const READING_GENRE_LABEL: Readonly<Record<ReadingGenre, string>> = {
  tale: "Cuento",
  fable: "Fábula",
  animals: "Fauna y animales",
  poem: "Poema",
  news: "Noticia",
  dialogue: "Diálogo",
  biography: "Biografía",
  legend: "Leyenda",
};
export const READING_GENRE_OPTIONS = READING_GENRES.map((value) => ({ value, label: READING_GENRE_LABEL[value] }));
export const isReadingGenre = (v: unknown): v is ReadingGenre => typeof v === "string" && (READING_GENRES as readonly string[]).includes(v);

// [Longitud del texto de la IA]: palabras aproximadas (= @Min(60) @Max(600) de DraftReadingBody)
export const READING_LENGTH_OPTIONS = [
  { value: "120", label: "Corto (~120 palabras)" },
  { value: "200", label: "Medio (~200 palabras)" },
  { value: "350", label: "Largo (~350 palabras)" },
  { value: "500", label: "Muy largo (~500 palabras)" },
] as const;

export const MAX_PARAGRAPHS = 100; // = ArrayMaxSize de CreateReadingBody
export const MAX_PARAGRAPH = 4000; // = MaxLength por párrafo

// [textToParagraphs]: texto importado (PDF, Word, OCR, página web) → párrafos | Función pura
// Con líneas en blanco → bloques · sin ellas (PDF/OCR cortan cada renglón) → se unen los renglones hasta un final de frase · verso: se conservan los saltos
export function textToParagraphs(text: string, verse = false): string[] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const blocks = /\n\s*\n/.test(clean) || verse ? clean.split(/\n\s*\n/) : joinWrappedLines(clean.split("\n"));
  return blocks
    .map((b) => (verse ? b.split("\n").map((l) => l.trim()).filter(Boolean).join("\n") : b.replace(/\s*\n\s*/g, " ").trim()))
    .filter(Boolean)
    .slice(0, MAX_PARAGRAPHS)
    .map((p) => p.slice(0, MAX_PARAGRAPH));
}

// [joinWrappedLines]: renglones cortados por el ancho de página → un párrafo termina en «. ! ? …» + renglón corto | `reduce`-like con acumulador
function joinWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  let cur = "";
  const width = Math.max(...lines.map((l) => l.trim().length)); // Ancho típico de renglón del documento
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    cur = cur ? `${cur} ${line}` : line;
    // Fin de párrafo: termina en puntuación final y el renglón es claramente más corto que el ancho del documento
    if (/[.!?…»"”]$/.test(line) && line.length < width * 0.8) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ─── Respuestas de NestJS (solo lo que se usa) ───────────────────────────────

export interface ReadingSentence {
  id: string;
  paragraph: number;
  position: number;
  text: string;
  translation: string | null;
  ipa: string;
  ipaUs: string | null;
  reviewed: boolean;
}

export interface ReadingTextSummary {
  id: string;
  title: string;
  language: string;
  level: string;
  genre: ReadingGenre;
  topic: string | null;
  summary: string | null;
  status: "draft" | "published";
  source: "ai" | "manual" | "import";
  sourceRef: string | null;
  sentenceCount: number;
  wordCount: number;
  updatedAt: string;
}

export interface ReadingTextDetail extends ReadingTextSummary {
  sentences: ReadingSentence[];
  editable: boolean;
  pending: number; // Frases sin IPA o sin traducción
}

// [paragraphsFromSentences]: frases → párrafos de texto (editar el texto completo en Gestión) | Función pura
export function paragraphsFromSentences(sentences: readonly Pick<ReadingSentence, "paragraph" | "text">[], verse = false): string[] {
  const out: string[][] = [];
  let last = Number.NaN;
  for (const s of sentences) {
    if (s.paragraph !== last) out.push([]);
    out[out.length - 1]!.push(s.text);
    last = s.paragraph;
  }
  return out.map((p) => p.join(verse ? "\n" : " "));
}
