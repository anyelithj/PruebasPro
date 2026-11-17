import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BOOK_GENRES,
  pickPlainTextUrl,
  type CatalogBook,
} from '../domain/book';
import type {
  BookCatalogPage,
  BookCatalogPort,
  BookSearch,
} from '../domain/book-catalog.port';
// [Adapter GutendexAdapter · Libros · RF-145 · 2026-11-14]: BookCatalogPort sobre la API JSON de Gutendex (catálogo de Project Gutenberg)
// [Config]: GUTENDEX_BASE_URL (por defecto https://gutendex.com) → se puede apuntar a una instancia propia
// [Resiliencia]: tiempo de espera por intento + reintentos con retroceso exponencial (solo red caída, 429 y 5xx) | [Patrón]: Adapter + Retry
// [Nada de descargas masivas]: una búsqueda = una página de Gutendex; el texto del libro lo descarga otro caso de uso, solo bajo pedido

interface GutendexPerson {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}
interface GutendexBook {
  id: number;
  title: string;
  authors: GutendexPerson[];
  languages: string[];
  formats: Record<string, string>;
  download_count: number;
  copyright: boolean | null; // true = protegido en EE. UU. · se filtra aquí (ver search)
}
interface GutendexList {
  next: string | null;
  results: GutendexBook[];
}

export const toCatalogBook = (b: GutendexBook): CatalogBook => ({
  id: b.id,
  title: b.title,
  authors: b.authors.map((a) => ({
    name: a.name,
    birthYear: a.birth_year ?? null,
    deathYear: a.death_year ?? null,
  })),
  languages: b.languages,
  textUrl: pickPlainTextUrl(b.formats ?? {}),
  downloadCount: b.download_count ?? 0,
  source: 'gutenberg',
  imageUrl: b.formats?.['image/jpeg'] ?? null, // [2026-11-17]: portada de Gutenberg
});

export interface RetryOptions {
  attempts: number;
  timeoutMs: number;
  baseDelayMs: number;
}
// ponytail: tope en memoria tras leer; el libro más largo de Gutenberg ronda unos MB · leer en streaming si se sube el tope
export const MAX_TEXT_BYTES = 20 * 1024 * 1024;
const RETRYABLE_STATUS = (s: number) => s === 429 || s >= 500;
const TEXT_TIMEOUT_MS = 240_000; // [2026-11-17]: descarga lenta del espejo (en segundo plano)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// [fetchWithRetry]: exportada para reutilizarla al descargar el texto (mismo criterio) | 4xx (salvo 429) no se reintenta
export async function fetchWithRetry(
  url: string,
  opts: RetryOptions,
  init: RequestInit = {},
): Promise<Response> {
  let last: unknown;
  let wait = 0; // [2026-11-17]: Retry-After del servidor (Wikimedia lo manda con 429) si es corto
  for (let i = 0; i < opts.attempts; i++) {
    if (i > 0) await sleep(Math.max(wait, opts.baseDelayMs * 2 ** (i - 1))); // 1×, 2×, 4×…
    try {
      const res = await fetch(url, {
        ...init,
        redirect: 'follow',
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
      if (!RETRYABLE_STATUS(res.status)) return res;
      last = new Error(`HTTP ${res.status}`);
      const after = Number(res.headers?.get('retry-after'));
      wait = after > 0 && after <= 5 ? after * 1000 : 0; // > 5 s: no cabe en el plazo de la petición → falla y entra el respaldo
    } catch (err) {
      last = err; // Red caída o tiempo agotado
    }
  }
  throw new ServiceUnavailableException(
    `El catálogo de libros no responde (${last instanceof Error ? last.message : 'error'})`,
  );
}

@Injectable()
export class GutendexAdapter implements BookCatalogPort {
  private readonly base: string;
  private readonly mirror: string; // Espejo oficial de Project Gutenberg (respaldo de la descarga)
  private readonly retry: RetryOptions = {
    attempts: 3,
    // [2026-11-16]: 8 s por intento → 3 intentos + esperas (~25 s) caben en los 30 s del TimeoutInterceptor (antes 15 s × 3 = 408 seguro si el catálogo tardaba)
    timeoutMs: 8_000,
    baseDelayMs: 500,
  };

  constructor(config: ConfigService) {
    this.base = (
      config.get<string>('GUTENDEX_BASE_URL') ?? 'https://gutendex.com'
    ).replace(/\/+$/, '');
    this.mirror = (
      config.get<string>('GUTENBERG_MIRROR_URL') ??
      'https://gutenberg.pglaf.org'
    ).replace(/\/+$/, '');
  }

  async search(q: BookSearch): Promise<BookCatalogPage> {
    // [Fix 2026-11-16 · 408 en /books]: el parámetro `copyright=false` deja la consulta de Gutendex colgada >25 s (sin él responde en <1 s) → se filtra aquí con el campo `copyright` de cada libro
    const qs = new URLSearchParams({ page: String(q.page) });
    if (q.search) qs.set('search', q.search);
    if (q.language) qs.set('languages', q.language);
    if (q.genre) qs.set('topic', BOOK_GENRES[q.genre]);
    // `/books/` con barra final: sin ella Gutendex responde 301 y se pierde un viaje
    const res = await fetchWithRetry(`${this.base}/books/?${qs}`, this.retry);
    if (res.status === 404) return { books: [], hasNext: false }; // Página fuera de rango
    if (!res.ok)
      throw new ServiceUnavailableException(`Gutendex respondió ${res.status}`);
    const body = (await res.json()) as GutendexList;
    return {
      books: (body.results ?? [])
        .filter((b) => b.copyright !== true) // Mismo criterio que copyright=false: fuera los protegidos en EE. UU.
        .map((b) => ({ ...toCatalogBook(b), genre: q.genre ?? null })),
      hasNext: !!body.next,
    };
  }

  // [downloadText]: solo desde gutenberg.org (la URL viene del catálogo → evita SSRF si la instancia de Gutendex no es de fiar) · tope de tamaño
  // [Fix 2026-11-16 · 503 «retry-after: 3600»]: gutenberg.org bloquea la IP 1 h tras varias descargas → 1 solo intento (reintentar alarga el bloqueo)
  // y, si falla, el ESPEJO OFICIAL (GUTENBERG_MIRROR_URL, por defecto https://gutenberg.pglaf.org · lista en gutenberg.org/MIRRORS.ALL) | [Patrón]: Fallback
  async downloadText(book: CatalogBook): Promise<string> {
    const url = new URL(book.textUrl ?? 'about:blank');
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new ServiceUnavailableException('El libro no tiene texto plano');
    if (!/(^|\.)gutenberg\.org$/i.test(url.hostname))
      throw new ServiceUnavailableException('Origen del texto no permitido');
    // `Number.isInteger` (ES2015): el id va en la ruta del espejo → solo enteros (nada de «../»)
    const mirror = Number.isInteger(book.id)
      ? `${this.mirror}/cache/epub/${book.id}/pg${book.id}.txt`
      : null;
    try {
      return await this.fetchText(url.href, {
        ...this.retry,
        attempts: 1,
        timeoutMs: 30_000,
      });
    } catch (err) {
      if (!mirror) throw err;
      // [2026-11-17]: el espejo puede ir a ~15 KB/s (un libro de 2 MB ≈ 2–3 min) · la descarga ya corre en segundo plano (BookTextUseCase) → plazo amplio
      return this.fetchText(mirror, {
        ...this.retry,
        attempts: 2,
        timeoutMs: TEXT_TIMEOUT_MS,
      });
    }
  }

  // [fetchText]: descarga + tope de tamaño + UTF-8 · un solo sitio para origen y espejo | [Principio]: DRY
  private async fetchText(href: string, opts: RetryOptions): Promise<string> {
    const res = await fetchWithRetry(href, opts);
    if (!res.ok)
      throw new ServiceUnavailableException(
        `Project Gutenberg respondió ${res.status}`,
      );
    const size = Number(res.headers?.get('content-length') ?? 0);
    if (size > MAX_TEXT_BYTES)
      throw new ServiceUnavailableException('El libro es demasiado grande');
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_TEXT_BYTES)
      throw new ServiceUnavailableException('El libro es demasiado grande');
    return new TextDecoder('utf-8').decode(bytes); // Se pide la variante UTF-8 (pickPlainTextUrl); ASCII es subconjunto
  }

  async getById(id: number): Promise<CatalogBook | null> {
    const res = await fetchWithRetry(`${this.base}/books/${id}`, this.retry);
    if (res.status === 404) return null;
    if (!res.ok)
      throw new ServiceUnavailableException(`Gutendex respondió ${res.status}`);
    return toCatalogBook((await res.json()) as GutendexBook);
  }
}
