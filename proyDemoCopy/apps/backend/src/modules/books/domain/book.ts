import { Language } from '../../../shared/domain/language.vo';
// [Book · Dominio · Libros · RF-145 · 2026-11-14]: libro del catálogo de dominio público (Project Gutenberg vía Gutendex) y sus reglas puras
// [Patrón]: Value Object + Pure Functions | [Principio]: SRP + determinístico + testeable sin Nest | [Paradigma]: Funcional

export interface BookAuthor {
  name: string;
  birthYear: number | null;
  deathYear: number | null;
}

export interface CatalogBook {
  id: number; // Id de Project Gutenberg
  title: string;
  authors: BookAuthor[];
  languages: string[]; // ISO 639-1 tal como los da Gutendex
  textUrl: string | null; // Texto plano (UTF-8 preferido); null = sin texto plano → no se puede leer
  downloadCount: number;
  source?: 'gutenberg' | 'wikisource'; // [2026-11-17]: sin valor = Gutenberg
  imageUrl?: string | null; // Portada (Gutenberg) o imagen de Wikidata (obra o retrato del autor)
  genre?: BookGenre | null; // [2026-11-17]: género con el que apareció en la búsqueda (categoría de Wikisource o filtro); no se guarda en BD
}

export const BOOK_LANGUAGES: readonly Language[] = Object.values(Language); // Los 7 idiomas de la plataforma
// [BOOK_GENRES · 2026-11-17]: género del catálogo → `topic` de Gutendex (busca en temas y estanterías de Gutenberg, sin mayúsculas)
export const BOOK_GENRES = {
  novel: 'fiction',
  tale: 'short stories',
  poetry: 'poetry',
  drama: 'drama',
  fable: 'fables',
  children: 'children',
  adventure: 'adventure',
  scifi: 'science fiction',
  mystery: 'detective',
  romance: 'love stories',
  philosophy: 'philosophy',
  history: 'history',
  fairy: 'fairy tales', // [2026-11-17]: + cuentos de hadas, ensayo y leyenda (Wikisource los tiene)
  essay: 'essays',
  legend: 'legends',
} as const;
export type BookGenre = keyof typeof BOOK_GENRES;

export const GUTENBERG_ATTRIBUTION =
  'Texto de Project Gutenberg (www.gutenberg.org), dominio público.';

// [Colombia · protección = vida del autor + 80 años (requisito del proyecto)]: la obra entra en dominio público el 1 de enero
// siguiente a los 80 años de la muerte → en `year` es libre si el autor murió como muy tarde en `year − 81` (2026 → 1945, «antes de 1946»)
export const lastFreeDeathYear = (year: number): number => year - 81;

// [isPublicDomainCO]: TODOS los autores con fecha de muerte conocida y ≤ límite · sin autores o sin fecha → no se muestra (no se puede comprobar)
export function isPublicDomainCO(
  authors: readonly BookAuthor[],
  year: number,
): boolean {
  const limit = lastFreeDeathYear(year);
  return (
    authors.length > 0 &&
    authors.every((a) => a.deathYear !== null && a.deathYear <= limit)
  );
}

// [isPlatformLanguage]: al menos uno de sus idiomas es de la plataforma (y el pedido si se filtró)
export const isPlatformLanguage = (
  languages: readonly string[],
  wanted?: string,
): boolean =>
  languages.some((l) =>
    wanted ? l === wanted : (BOOK_LANGUAGES as readonly string[]).includes(l),
  );

// [pickPlainTextUrl]: de los formatos de Gutendex (mime → url) elige texto plano UTF-8; si no, cualquier text/plain que no sea .zip
export function pickPlainTextUrl(
  formats: Readonly<Record<string, string>>,
): string | null {
  const plain = Object.entries(formats).filter(
    ([mime, url]) => mime.startsWith('text/plain') && !url.endsWith('.zip'),
  );
  const utf8 = plain.find(([mime]) => /charset=utf-8/i.test(mime));
  return (utf8 ?? plain[0])?.[1] ?? null;
}

// [visibleBooks]: filtro de dominio que aplica el caso de uso a lo que devuelva cualquier catálogo
export const visibleBooks = (
  books: readonly CatalogBook[],
  year: number,
  language?: string,
): CatalogBook[] =>
  books.filter(
    (b) =>
      b.textUrl !== null &&
      isPlatformLanguage(b.languages, language) &&
      isPublicDomainCO(b.authors, year),
  );
