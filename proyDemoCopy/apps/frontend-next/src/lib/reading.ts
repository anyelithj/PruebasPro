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

// [Longitud del texto de la IA]: palabras aproximadas (= @Min(MIN_DRAFT_WORDS=60) @Max(MAX_DRAFT_WORDS=900) de DraftReadingBody)
export const READING_LENGTH_OPTIONS = [
  { value: "220", label: "Corto (~220 palabras)" },
  { value: "350", label: "Medio (~350 palabras)" },
  { value: "550", label: "Largo (~550 palabras)" },
  { value: "800", label: "Muy largo (~800 palabras)" },
] as const;

// [READING_WORDS_BY_LEVEL · 2026-10-28]: palabras que pide «Crear actividad» según el nivel MCER — espejo de READING_SHAPE de NestJS
// (≥ 6 párrafos × ~5 frases en TODOS los niveles: A1 6×5 … C2 8×5–6) | `Readonly<Record<…>>` (TS): tabla inmutable | [Principio]: SSOT en el front (antes vivía suelta en activity-kinds)
export const READING_WORDS_BY_LEVEL: Readonly<Record<string, number>> = { A1: 220, A2: 300, B1: 420, B2: 560, C1: 680, C2: 800 };
// [readingWordsFor]: «B1+» → B1 · nivel desconocido → A2 | Función pura
export const readingWordsFor = (level: string): number => READING_WORDS_BY_LEVEL[level.slice(0, 2).toUpperCase()] ?? READING_WORDS_BY_LEVEL.A2!;

// [Dictado · 2026-11-16]: lectura o dictado (/lectura/dictado) · un dictado = ≥ 3 párrafos de ≥ 5 frases (= dictationProblem de NestJS)
export const READING_KIND_OPTIONS = [
  { value: "reading", label: "Lectura" },
  { value: "dictation", label: "Dictado" },
] as const;
export const DICTATION_MIN_PARAGRAPHS = 3;
export const DICTATION_MIN_SENTENCES = 5;
// [sentencesIn · Fix 2026-11-17]: frases de un párrafo con la MISMA regla que splitSentences de NestJS (antes `Intl.Segmenter` → cuentas distintas a las del servidor)
// Fin de frase = . ! ? … (+ comillas) + espacio + mayúscula/dígito/signo de apertura · «Mr.», «Sra.» o una inicial («J.») no cierran | Función pura
const BOUNDARY = /[.!?…]+["'»”’)\]]*\s+(?=["'«“‘(\[¿¡—–-]?[\p{Lu}\p{N}])/gu;
const ABBREVIATIONS: ReadonlySet<string> = new Set(["mr.", "mrs.", "ms.", "dr.", "prof.", "st.", "jr.", "sr.", "vs.", "etc.", "e.g.", "i.e.", "no.", "mt.", "inc.", "ltd.", "sra.", "srta.", "dra.", "ud.", "uds.", "pág.", "núm.", "av.", "aprox.", "m.", "mme.", "mlle.", "p.ex.", "cf.", "z.b.", "bzw.", "usw.", "hr.", "fr.", "nr.", "ca.", "d.h.", "u.a.", "sr.ª", "dr.ª", "v.", "pe."]);
export function sentencesIn(paragraph: string): number {
  const text = paragraph.replace(/\s+/g, " ").trim();
  if (!text) return 0;
  let n = 1;
  let start = 0;
  for (const m of text.matchAll(BOUNDARY)) {
    const idx = m.index ?? 0;
    const w = `${text.slice(start, idx).split(" ").pop() ?? ""}.`.toLowerCase().replace(/^[("'«“‘¿¡]+/, "");
    if (m[0].startsWith(".") && !m[0].startsWith("..") && (/^\p{L}\.$/u.test(w) || ABBREVIATIONS.has(w))) continue;
    n++;
    start = idx + m[0].length;
  }
  return n;
}
// [dictationProblems]: mensajes que dicen QUÉ falta y CÓMO arreglarlo | Función pura
export function dictationProblems(paragraphs: readonly string[]): string[] {
  const rule = `un dictado necesita al menos ${DICTATION_MIN_PARAGRAPHS} párrafos de ${DICTATION_MIN_SENTENCES} frases o más`;
  if (paragraphs.length < DICTATION_MIN_PARAGRAPHS)
    return [`El texto tiene ${paragraphs.length} párrafo(s) y ${rule}: añade párrafos con «Añadir párrafo» o vuelve a generar el texto.`];
  return paragraphs.flatMap((p, i) => {
    const n = sentencesIn(p);
    return n < DICTATION_MIN_SENTENCES ? [`El párrafo ${i + 1} tiene ${n} frase(s) y ${rule}: escribe ${DICTATION_MIN_SENTENCES - n} frase(s) más en él o únelo con otro párrafo.`] : [];
  });
}

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
  enriching?: boolean; // [2026-10-27]: `true` = NestJS las está generando en segundo plano (la vista sondea hasta que termine)
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
