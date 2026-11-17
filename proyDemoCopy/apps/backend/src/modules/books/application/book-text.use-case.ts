import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { BOOK_LANGUAGES } from '../domain/book';
import {
  BOOK_CATALOG,
  type BookCatalogPort,
} from '../domain/book-catalog.port';
import { BookText } from '../domain/entities/book-text.entity';
import {
  chapterPage,
  sectionsOf,
  splitChapters,
  stripGutenbergBoilerplate,
  type ChapterPage,
} from '../domain/gutenberg-text';
import {
  SearchBooksUseCase,
  SEARCH_TTL_MS,
  type BookView,
} from './search-books.use-case';
// [UseCase BookText · Libros · RF-146 · 2026-11-14]: índice de capítulos y páginas de un libro · el texto se descarga SOLO cuando un usuario abre el libro
// [Uno a la vez]: cola global (una descarga en curso en todo el proceso) + peticiones simultáneas del mismo libro comparten la misma promesa
// [Caché]: PostgreSQL (texto limpio, para siempre) + Redis (cada página, 24 h) | [Nivel MCER]: null = «sin clasificar» (sin fuente fiable, no se inventa)
// [Patrón]: Cache-aside + Single-flight + Queue | [Principio]: SRP + DIP

export interface BookIndex {
  book: BookView;
  language: string;
  level: null; // «sin clasificar»
  chapters: {
    index: number;
    title: string;
    paragraphs: number;
    sections: { title: string; paragraph: number }[]; // [2026-11-17]: «Letter N» dentro del capítulo
  }[];
}

// [BookPreparing · 2026-11-17]: el texto aún se descarga en segundo plano → el lector vuelve a preguntar (antes la petición moría a los 30 s y no se veía nada)
export interface BookPreparing {
  book: BookView;
  preparing: true;
}
export const PREPARE_WAIT_MS = 15_000; // Espera máxima dentro de la petición (cabe en los 30 s del TimeoutInterceptor)
const FAILURE_TTL_MS = 2 * 60 * 1000; // Un fallo reciente se informa una vez en vez de reintentar en bucle

@Injectable()
export class BookTextUseCase {
  private readonly failures = new Map<
    number,
    { at: number; message: string }
  >();
  private queue: Promise<unknown> = Promise.resolve(); // ponytail: cola por proceso; con varias réplicas de NestJS usar un candado en Redis
  private readonly inflight = new Map<number, Promise<BookText>>();

  constructor(
    @Inject(BOOK_CATALOG) private readonly catalog: BookCatalogPort,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectRepository(BookText) private readonly texts: Repository<BookText>,
    private readonly books: SearchBooksUseCase,
  ) {}

  // [index · Fix 2026-11-17]: libro guardado → índice al instante · si no, descarga EN SEGUNDO PLANO y espera como mucho PREPARE_WAIT_MS
  // Espejo lento de Gutenberg (~15 KB/s) o Wikisource con muchos capítulos ya no agotan el plazo HTTP | [Patrón]: Async Request-Reply
  async index(id: number): Promise<BookIndex | BookPreparing> {
    const book = await this.books.get(id); // 404 si no es de dominio público
    const failed = this.failures.get(id);
    if (failed && Date.now() - failed.at < FAILURE_TTL_MS) {
      this.failures.delete(id); // El siguiente intento vuelve a descargar
      throw new ServiceUnavailableException(failed.message);
    }
    const running = this.ensureText(book);
    running.catch((err: unknown) =>
      this.failures.set(id, {
        at: Date.now(),
        message: `No se pudo descargar el libro: ${err instanceof Error ? err.message : String(err)}`,
      }),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const text = await Promise.race([
      running,
      new Promise<null>(
        (r) => (timer = setTimeout(() => r(null), PREPARE_WAIT_MS)),
      ),
    ])
      .catch((err: unknown) => {
        this.failures.delete(id); // Ya se informa en ESTA respuesta
        throw err;
      })
      .finally(() => clearTimeout(timer)); // Sin temporizadores colgados
    if (!text) return { book, preparing: true };
    return {
      book,
      language: text.language,
      level: null,
      chapters: text.chapters.map((c, index) => ({
        index,
        title: c.title,
        paragraphs: c.paragraphs.length,
        sections: sectionsOf(c),
      })),
    };
  }

  async page(id: number, chapter: number, page: number): Promise<ChapterPage> {
    const key = `books:page:${id}:${chapter}:${page}`;
    const hit = await this.cache.get<ChapterPage>(key);
    if (hit) return hit;
    const text = await this.ensureText(await this.books.get(id));
    const out = chapterPage(text.chapters, chapter, page, text.language);
    if (!out) throw new NotFoundException('Capítulo o página fuera de rango');
    await this.cache.set(key, out, SEARCH_TTL_MS);
    return out;
  }

  // [paragraph · RF-146]: un párrafo de un libro YA abierto (+ el anterior como contexto) · nunca dispara una descarga
  async paragraph(
    id: number,
    chapter: number,
    index: number,
  ): Promise<{ language: string; text: string; previous: string }> {
    const stored = await this.texts.findOne({ where: { bookId: id } });
    const paragraphs = stored?.chapters[chapter]?.paragraphs;
    const text = paragraphs?.[index];
    if (!stored || !paragraphs || text === undefined)
      throw new NotFoundException('Párrafo no disponible: abre antes el libro');
    return {
      language: stored.language,
      text,
      previous: paragraphs[index - 1] ?? '',
    };
  }

  private async ensureText(book: BookView): Promise<BookText> {
    const stored = await this.texts.findOne({ where: { bookId: book.id } });
    if (stored) return stored;
    let running = this.inflight.get(book.id);
    if (!running) {
      running = this.enqueue(() => this.download(book)).finally(() =>
        this.inflight.delete(book.id),
      );
      this.inflight.set(book.id, running);
    }
    return running;
  }

  // [enqueue]: la siguiente descarga empieza cuando termina (bien o mal) la anterior
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async download(book: BookView): Promise<BookText> {
    const language =
      book.languages.find((l) =>
        (BOOK_LANGUAGES as readonly string[]).includes(l),
      ) ?? book.languages[0];
    const chapters = this.catalog.downloadChapters
      ? await this.catalog.downloadChapters(book)
      : splitChapters(
          stripGutenbergBoilerplate(await this.catalog.downloadText(book)),
        );
    if (!chapters.length)
      throw new NotFoundException('El libro no tiene texto legible');
    return this.texts.save(
      this.texts.create({ bookId: book.id, language, chapters }),
    );
  }
}
