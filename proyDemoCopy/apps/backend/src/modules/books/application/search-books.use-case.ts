import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import {
  GUTENBERG_ATTRIBUTION,
  visibleBooks,
  type CatalogBook,
} from '../domain/book';
import {
  BOOK_CATALOG,
  type BookCatalogPort,
  type BookSearch,
} from '../domain/book-catalog.port';
import { Book } from '../domain/entities/book.entity';
import { WIKISOURCE_ATTRIBUTION } from '../domain/wikisource';
// [UseCases SearchBooks / GetBook · Libros · RF-145 · 2026-11-14]: búsqueda por título o autor con filtro de idioma y de dominio público (Colombia)
// [Caché]: Redis (página de resultados, 24 h) + PostgreSQL (ficha de cada libro visto → abrirlo no vuelve a pedir el catálogo)
// [Patrón]: Cache-aside + Ports & Adapters | [Principio]: DIP (BookCatalogPort) + SRP | [Atribución]: cada libro la lleva

export const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;

export interface BookView extends CatalogBook {
  attribution: string;
  sourceUrl: string; // Ficha del libro en gutenberg.org o la página de Wikisource
}
export interface BookSearchResult {
  books: BookView[];
  page: number;
  hasNext: boolean;
}

// [2026-11-17]: atribución y enlace según el origen (Gutenberg o Wikisource)
const toView = (b: CatalogBook): BookView => ({
  ...b,
  source: b.source ?? 'gutenberg',
  imageUrl: b.imageUrl ?? null,
  ...(b.source === 'wikisource'
    ? { attribution: WIKISOURCE_ATTRIBUTION, sourceUrl: b.textUrl ?? '' }
    : {
        attribution: GUTENBERG_ATTRIBUTION,
        sourceUrl: `https://www.gutenberg.org/ebooks/${b.id}`,
      }),
});
const fromEntity = (e: Book): CatalogBook => ({
  id: e.id,
  title: e.title,
  authors: e.authors,
  languages: e.languages,
  textUrl: e.textUrl,
  downloadCount: e.downloadCount,
  source: e.source,
  imageUrl: e.imageUrl,
});

@Injectable()
export class SearchBooksUseCase {
  constructor(
    @Inject(BOOK_CATALOG) private readonly catalog: BookCatalogPort,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectRepository(Book) private readonly books: Repository<Book>,
  ) {}

  async search(q: BookSearch, now = new Date()): Promise<BookSearchResult> {
    const key = `books:search:${q.language ?? '*'}:${q.genre ?? '*'}:${(q.search ?? '').trim().toLowerCase()}:${q.page}`;
    const hit = await this.cache.get<BookSearchResult>(key);
    if (hit) return hit;
    const page = await this.catalog.search(q);
    const visible = visibleBooks(page.books, now.getFullYear(), q.language);
    if (visible.length)
      await this.books.save(visible.map((b) => this.books.create(b))); // Upsert por id (PK)
    const result = {
      books: visible.map(toView),
      page: q.page,
      hasNext: page.hasNext,
    };
    await this.cache.set(key, result, SEARCH_TTL_MS);
    return result;
  }

  // [get]: ficha de un libro (BD primero; si no, el catálogo) · un libro que no pase el filtro de dominio público no existe para la plataforma
  async get(id: number, now = new Date()): Promise<BookView> {
    const stored = await this.books.findOne({ where: { id } });
    const book = stored ? fromEntity(stored) : await this.catalog.getById(id);
    if (!book || !visibleBooks([book], now.getFullYear()).length)
      throw new NotFoundException('Libro no disponible');
    if (!stored) await this.books.save(this.books.create(book));
    return toView(book);
  }
}
