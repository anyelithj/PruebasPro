import {
  splitParagraphs,
  splitSentences,
} from '../../reading/domain/sentence-splitter';
// [GutenbergText · Dominio · Libros · RF-146 · 2026-11-14]: texto plano de Project Gutenberg → sin encabezado ni pie de licencia → capítulos → párrafos → frases
// [Reutiliza]: splitParagraphs / splitSentences de Lectura (abreviaturas por idioma ya probadas) | [Patrón]: Pure Functions | [Paradigma]: Funcional

export interface BookChapter {
  title: string;
  paragraphs: string[];
}

export const PARAGRAPHS_PER_PAGE = 20; // Carga progresiva: nunca se envía el libro (ni un capítulo largo) entero
const CHUNK_PARAGRAPHS = 60; // Libro sin títulos de capítulo reconocibles → «Parte n» de este tamaño

// Marcas de Project Gutenberg: «*** START OF THE/THIS PROJECT GUTENBERG EBOOK … ***» y «*** END OF …»
const START =
  /^\s*\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;
const END =
  /^\s*\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;
// Pie antiguo sin asteriscos: «End of the Project Gutenberg EBook of …» / «End of Project Gutenberg's …»
const OLD_END = /^\s*End of (?:the )?Project Gutenberg'?s?[^\n]*$/im;

// [stripGutenbergBoilerplate]: quita BOM, encabezado y pie de licencia · sin marcas → el texto entero (mejor leer de más que perder el libro)
export function stripGutenbergBoilerplate(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const start = START.exec(text);
  if (start) text = text.slice(start.index + start[0].length);
  const end = END.exec(text) ?? OLD_END.exec(text);
  if (end) text = text.slice(0, end.index);
  return text.trim();
}

// Títulos de capítulo en los 7 idiomas (línea propia, corta) | `u`: Unicode (cirílico, chino)
const HEADING =
  /^(?:(?:CHAPTER|Chapter|BOOK|Book|PART|Part|CHAPITRE|Chapitre|LIVRE|Livre|KAPITEL|Kapitel|CAPÍTULO|Capítulo|CAPITULO|Capitulo|ГЛАВА|Глава|ЧАСТЬ|Часть)\s+[\p{L}\p{N}.\-–—:]+.*|第[一二三四五六七八九十百千零〇\d]+[章回節节卷].*)$/u;

const isHeading = (p: string): boolean => p.length <= 120 && HEADING.test(p);

// [splitChapters]: párrafos con títulos reconocibles → capítulos; si no hay, partes de tamaño fijo · el texto previo al primer título = «Inicio»
export function splitChapters(text: string): BookChapter[] {
  const paragraphs = splitParagraphs(text);
  const chapters: BookChapter[] = [];
  let current: BookChapter | null = null;
  for (const p of paragraphs) {
    if (isHeading(p)) {
      current = { title: p, paragraphs: [] };
      chapters.push(current);
    } else {
      if (!current)
        chapters.push((current = { title: 'Inicio', paragraphs: [] }));
      current.paragraphs.push(p);
    }
  }
  const real = chapters.filter((c) => c.paragraphs.length > 0); // Índices («CHAPTER I» sin cuerpo en la tabla de contenido) fuera
  if (real.length > 1) return real;
  const all = real.flatMap((c) => c.paragraphs);
  const parts: BookChapter[] = [];
  for (let i = 0; i < all.length; i += CHUNK_PARAGRAPHS)
    parts.push({
      title: `Parte ${parts.length + 1}`,
      paragraphs: all.slice(i, i + CHUNK_PARAGRAPHS),
    });
  return parts;
}

// [sectionsOf · 2026-11-17]: títulos DENTRO de un capítulo («Letter 1…4» de Frankenstein van en «Inicio») → entradas del índice lateral
// Solo párrafos cortos que son el título solo (no el índice «Letter 1 Letter 2 …» en una línea) | Función pura
const SECTION =
  /^(?:letter|lettre|carta|brief|lettera|письмо)\s+(?:\d+|[ivxlcdm]+)\.?$/iu;
export const sectionsOf = (
  c: BookChapter,
): { title: string; paragraph: number }[] =>
  c.paragraphs.flatMap((p, paragraph) =>
    p.length <= 40 && SECTION.test(p.trim())
      ? [{ title: p.trim().replace(/\.$/, ''), paragraph }]
      : [],
  );

export interface ChapterPage {
  chapter: number;
  title: string;
  page: number;
  pages: number;
  paragraphs: { index: number; sentences: string[] }[]; // `index` = posición del párrafo en el capítulo (clave de traducción y progreso)
}

// [chapterPage]: una página del capítulo con cada párrafo ya dividido en frases
export function chapterPage(
  chapters: readonly BookChapter[],
  chapter: number,
  page: number,
  language: string,
): ChapterPage | null {
  const c = chapters[chapter];
  if (!c) return null;
  const pages = Math.max(
    1,
    Math.ceil(c.paragraphs.length / PARAGRAPHS_PER_PAGE),
  );
  if (page < 1 || page > pages) return null;
  const from = (page - 1) * PARAGRAPHS_PER_PAGE;
  return {
    chapter,
    title: c.title,
    page,
    pages,
    paragraphs: c.paragraphs
      .slice(from, from + PARAGRAPHS_PER_PAGE)
      .map((p, i) => ({
        index: from + i,
        sentences: splitSentences(p, language),
      })),
  };
}

// [translationChunks · RF-146]: frases → trozos ≤ `max` caracteres (límite de FastAPI /translate) sin perder texto
// Agrupa frases enteras; una frase más larga (o chino sin espacios) se corta por caracteres | Función pura
export function translationChunks(
  sentences: readonly string[],
  max = 500,
): string[] {
  const out: string[] = [];
  let cur = '';
  for (const s of sentences.flatMap((x) => {
    const parts: string[] = [];
    for (let i = 0; i < x.length; i += max) parts.push(x.slice(i, i + max));
    return parts;
  })) {
    const joined = cur ? `${cur} ${s}` : s;
    if (joined.length > max) {
      out.push(cur);
      cur = s;
    } else cur = joined;
  }
  if (cur) out.push(cur);
  return out;
}
