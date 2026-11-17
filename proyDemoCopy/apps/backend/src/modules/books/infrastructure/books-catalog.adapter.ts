import { Injectable, Logger } from '@nestjs/common';
import type { CatalogBook } from '../domain/book';
import type {
  BookCatalogPage,
  BookCatalogPort,
  BookSearch,
} from '../domain/book-catalog.port';
import {
  splitChapters,
  stripGutenbergBoilerplate,
  type BookChapter,
} from '../domain/gutenberg-text';
import { parseWikisourceId, wikisourceCategories } from '../domain/wikisource';
import { GutendexAdapter } from './gutendex.adapter';
import { WikisourceAdapter } from './wikisource.adapter';
// [Adapter BooksCatalogAdapter · Libros · 2026-11-17]: UN catálogo para el caso de uso con dos fuentes
// Idioma + género que Wikisource cubre → Wikisource (textos originales con géneros reales) · si no lo cubre, falla o no hay resultados → Gutendex
// Abrir/descargar: el id dice la fuente (≥ 1 000 000 000 = Wikisource) | [Patrón]: Composite + Fallback | [Principio]: OCP (el caso de uso no cambia)

@Injectable()
export class BooksCatalogAdapter implements BookCatalogPort {
  private readonly log = new Logger(BooksCatalogAdapter.name);

  constructor(
    private readonly gutendex: GutendexAdapter,
    private readonly wikisource: WikisourceAdapter,
  ) {}

  async search(q: BookSearch): Promise<BookCatalogPage> {
    const categories = q.language
      ? wikisourceCategories(q.language, q.genre)
      : [];
    if (categories.length) {
      try {
        const r = await this.wikisource.search(q, categories);
        if (r.books.length || q.page > 1) return r;
      } catch (err) {
        this.log.warn(
          `Wikisource no respondió, se usa Gutendex: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return this.gutendex.search(q);
  }

  getById(id: number): Promise<CatalogBook | null> {
    return parseWikisourceId(id)
      ? this.wikisource.getById(id)
      : this.gutendex.getById(id);
  }

  downloadText(book: CatalogBook): Promise<string> {
    return this.gutendex.downloadText(book);
  }

  async downloadChapters(book: CatalogBook): Promise<BookChapter[]> {
    if (parseWikisourceId(book.id))
      return this.wikisource.downloadChapters(book);
    return splitChapters(
      stripGutenbergBoilerplate(await this.gutendex.downloadText(book)),
    );
  }
}
