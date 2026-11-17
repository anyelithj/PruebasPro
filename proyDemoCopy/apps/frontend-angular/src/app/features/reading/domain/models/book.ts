import * as z from 'zod';
// [Book · Dominio · Lectura → Libros · RF-145/146/147 · 2026-11-14]: contrato de /books (NestJS) validado con Zod + funciones puras del lector
// [Patrón]: DTO validado + Pure Functions | [Principio]: SSOT (mismos campos que BookView/BookIndex/ChapterPage de NestJS) | [Paradigma]: Funcional

export const BookAuthorSchema = z.object({ name: z.string(), birthYear: z.number().nullable(), deathYear: z.number().nullable() });

export const BookSchema = z.object({
  id: z.number(),
  title: z.string(),
  authors: z.array(BookAuthorSchema),
  languages: z.array(z.string()),
  attribution: z.string(),
  sourceUrl: z.string(),
  // [2026-11-17 · Wikisource]: origen y portada (Gutenberg) o imagen de Wikidata · opcionales: respuesta vieja sin ellos
  source: z.enum(['gutenberg', 'wikisource']).default('gutenberg'),
  imageUrl: z.string().nullable().default(null),
  genre: z.string().nullable().default(null), // [2026-11-17]: género con el que apareció en la búsqueda (null = sin género)
});
export type Book = z.infer<typeof BookSchema>;

// [coverFallback · 2026-11-17]: portada de gutenberg.org caída (mantenimiento / 503) → la misma del ESPEJO oficial; si ya es el espejo u otra fuente → null (sin imagen)
export const GUTENBERG_MIRROR = 'https://gutenberg.pglaf.org';
export function coverFallback(url: string): string | null {
  const m = /^https:\/\/www\.gutenberg\.org(\/cache\/epub\/\d+\/[\w.-]+)$/.exec(url);
  return m ? GUTENBERG_MIRROR + m[1] : null;
}

export const BookSearchResultSchema = z.object({ books: z.array(BookSchema), page: z.number(), hasNext: z.boolean() });
export type BookSearchResult = z.infer<typeof BookSearchResultSchema>;

export const BookIndexSchema = z.object({
  book: BookSchema,
  language: z.string(),
  level: z.string().nullable(), // null = «sin clasificar» (no se inventa)
  // [2026-11-17]: `sections` = títulos dentro del capítulo («Letter 1…4») → entradas del índice lateral · `default`: respuesta vieja sin ellos
  chapters: z.array(
    z.object({ index: z.number(), title: z.string(), paragraphs: z.number(), sections: z.array(z.object({ title: z.string(), paragraph: z.number() })).default([]) }),
  ),
});
export type BookIndex = z.infer<typeof BookIndexSchema>;
// [2026-11-17]: el servidor aún descarga el libro en segundo plano → se vuelve a preguntar
export const BookPreparingSchema = z.object({ book: BookSchema, preparing: z.literal(true) });
export const BookOpenSchema = z.union([BookPreparingSchema, BookIndexSchema]);
export type BookOpen = z.infer<typeof BookOpenSchema>;

export const ChapterPageSchema = z.object({
  chapter: z.number(),
  title: z.string(),
  page: z.number(),
  pages: z.number(),
  paragraphs: z.array(z.object({ index: z.number(), sentences: z.array(z.string()) })),
});
export type ChapterPage = z.infer<typeof ChapterPageSchema>;

export const BookPositionSchema = z.object({ chapter: z.number(), paragraph: z.number(), sentence: z.number() });
export type BookPosition = z.infer<typeof BookPositionSchema>;

export const PARAGRAPHS_PER_PAGE = 20; // = NestJS (gutenberg-text.ts)
// [BOOK_GENRES · 2026-11-17]: = claves de BOOK_GENRES de NestJS (cada una → `topic` de Gutendex)
export const BOOK_GENRES = ['novel', 'tale', 'poetry', 'drama', 'fable', 'fairy', 'legend', 'essay', 'children', 'adventure', 'scifi', 'mystery', 'romance', 'philosophy', 'history'] as const;
export type BookGenre = (typeof BOOK_GENRES)[number];

// [TocEntry · 2026-11-17]: entrada del índice lateral = un capítulo o un título dentro de él («Letter 2») con su párrafo de inicio
export interface TocEntry {
  title: string;
  chapter: number;
  paragraph: number;
}
// [tocEntries]: capítulos en orden; si un capítulo tiene títulos dentro, el capítulo solo aparece si tiene texto antes del primero | Función pura
export const tocEntries = (chapters: BookIndex['chapters']): TocEntry[] =>
  chapters.flatMap((c) => [
    ...(c.sections[0]?.paragraph === 0 ? [] : [{ title: c.title, chapter: c.index, paragraph: 0 }]),
    ...c.sections.map((s) => ({ title: s.title, chapter: c.index, paragraph: s.paragraph })),
  ]);
// [activeEntry]: índice de la entrada donde está (capítulo, párrafo) → la última que empieza antes o en ese párrafo | -1 si ninguna
export const activeEntry = (entries: readonly TocEntry[], chapter: number, paragraph: number): number =>
  entries.reduce((found, e, i) => (e.chapter === chapter && e.paragraph <= paragraph ? i : found), -1);

// [BookLine]: una frase del lector con su posición estable (párrafo del capítulo + frase del párrafo)
// [SentenceIpa · 2026-11-16]: IPA de una frase + `parts` = renglones (cláusulas) con su IPA → se muestra renglón a renglón
export interface SentenceIpa {
  ipa: string;
  ipa_us: string | null;
  parts: { text: string; ipa: string }[];
}

export interface BookLine {
  paragraph: number;
  sentence: number;
  text: string;
}

// [linesOf]: páginas cargadas → lista plana de frases (lo que recorre el reproductor) | Función pura
export const linesOf = (pages: readonly ChapterPage[]): BookLine[] =>
  pages.flatMap((p) => p.paragraphs.flatMap((para) => para.sentences.map((text, sentence) => ({ paragraph: para.index, sentence, text }))));

// [lineIndexOf]: posición guardada → índice en la lista plana (0 si ya no existe)
export const lineIndexOf = (lines: readonly BookLine[], pos: Pick<BookPosition, 'paragraph' | 'sentence'>): number =>
  Math.max(0, lines.findIndex((l) => l.paragraph === pos.paragraph && l.sentence === pos.sentence));

// [pageOfParagraph]: página (1…) donde está un párrafo → se retoma cargando solo esa página
export const pageOfParagraph = (paragraph: number): number => Math.floor(paragraph / PARAGRAPHS_PER_PAGE) + 1;

// [chapterProgress]: 0–100 % del capítulo según el párrafo actual (sin cargar el capítulo entero)
export const chapterProgress = (paragraph: number, total: number): number =>
  total <= 0 ? 0 : Math.min(100, Math.round(((paragraph + 1) / total) * 100));

// [sourceHost · 2026-11-17]: «gutenberg.org» / «es.wikisource.org» para el enlace de atribución
export const sourceHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// [authorsLabel]: «Nombre (1775–1817)» para la atribución
export const authorsLabel = (b: Pick<Book, 'authors'>): string =>
  b.authors.map((a) => (a.birthYear || a.deathYear ? `${a.name} (${a.birthYear ?? '?'}–${a.deathYear ?? '?'})` : a.name)).join(', ');
