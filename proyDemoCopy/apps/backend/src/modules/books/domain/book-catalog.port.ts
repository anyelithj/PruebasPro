import type { BookGenre, CatalogBook } from './book';
import type { BookChapter } from './gutenberg-text';
// [Port BookCatalogPort · Libros · RF-145 · 2026-11-14]: catálogo de libros de dominio público sin que el caso de uso conozca Gutendex
// [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | Adaptador actual: GutendexAdapter (URL configurable → instancia propia)

export const BOOK_CATALOG = Symbol('BOOK_CATALOG');

export interface BookSearch {
  search?: string; // Título o autor
  language?: string; // ISO 639-1 (uno de los 7)
  genre?: BookGenre; // [2026-11-17]: novela, cuento, poesía…
  page: number; // 1…
}

export interface BookCatalogPage {
  books: CatalogBook[];
  hasNext: boolean;
}

export interface BookCatalogPort {
  search(q: BookSearch): Promise<BookCatalogPage>;
  getById(id: number): Promise<CatalogBook | null>;
  // [downloadText · RF-146]: texto plano de UN libro (bajo pedido del usuario; el caso de uso garantiza uno a la vez)
  downloadText(book: CatalogBook): Promise<string>;
  // [downloadChapters · 2026-11-17]: catálogos que ya dan el texto por capítulos (Wikisource: una página por capítulo)
  downloadChapters?(book: CatalogBook): Promise<BookChapter[]>;
}
