import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BookAuthor, BookGenre, CatalogBook } from '../domain/book';
import type { BookCatalogPage, BookSearch } from '../domain/book-catalog.port';
import type { BookChapter } from '../domain/gutenberg-text';
import {
  AUTHOR_NS,
  genreOfCategory,
  htmlToParagraphs,
  pageUrl,
  parseWikisourceId,
  subpageLinks,
  versionLink,
  wikisourceId,
  yearOf,
} from '../domain/wikisource';
import { MAX_TEXT_BYTES, type RetryOptions } from './gutendex.adapter';
// [Adapter WikisourceAdapter · Libros · 2026-11-17]: catálogo y texto de Wikisource (API de MediaWiki) + autores y fechas de Wikidata
// Géneros = categorías (domain/wikisource) · autor = P50 de la obra en Wikidata (o la página «Autor:» que enlaza la obra) · portada = P18 de la obra o retrato del autor
// [Cortesía con Wikimedia]: User-Agent propio (WIKIMEDIA_USER_AGENT), listas de categorías en memoria 6 h, textos de 4 en 4 · nada de búsqueda de texto (CirrusSearch limita mucho)
// [Patrón]: Adapter + Cache-aside (memoria) | [Principio]: SRP (las reglas puras viven en domain/wikisource)

export const PAGE_SIZE = 24;
const MAX_PER_CATEGORY = 1000; // 2 peticiones de 500 como mucho
const MAX_CHAPTERS = 60; // 60 × ~0,4 s caben en los 30 s del TimeoutInterceptor
// [Ritmo · Fix 2026-11-17 · HTTP 429]: Wikimedia permite ~200 peticiones/min con un User-Agent CON contacto y ~10/min sin él
// → el hueco entre peticiones depende de si WIKIMEDIA_USER_AGENT trae contacto (correo o URL) | [Patrón]: Rate Limiter + Circuit Breaker (pausa)
const GAP_MS = 350; // Con contacto: ≤ ~170 peticiones/min
const GAP_NO_CONTACT_MS = 6_500; // Sin contacto: ≤ ~9 peticiones/min (por debajo del tope de 10)
const FOREGROUND_WAIT_MS = 2_500; // Búsqueda/ficha: si habría que esperar más → se falla YA y entra Gutendex (la pantalla no se cuelga)
const BACKGROUND_WAIT_MS = 10 * 60 * 1000; // Descarga en segundo plano: espera su turno (no hay usuario esperando la petición)
const DEFAULT_PAUSE_S = 60; // 429 sin Retry-After → 1 min de pausa
const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const LIST_TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 4;

interface Page {
  pageid: number;
  title: string;
}
interface Claim {
  mainsnak: { datavalue?: { value: unknown } };
}
interface Entity {
  labels?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
}

const claimValues = (e: Entity | undefined, p: string): unknown[] =>
  (e?.claims?.[p] ?? [])
    .map((c) => c.mainsnak.datavalue?.value)
    .filter((v) => v !== undefined);
const claimIds = (e: Entity | undefined, p: string): string[] =>
  claimValues(e, p).flatMap((v) =>
    (v as { id?: string }).id ? [(v as { id: string }).id] : [],
  );
const claimTime = (e: Entity | undefined, p: string): number | null =>
  yearOf((claimValues(e, p)[0] as { time?: string } | undefined)?.time);
const commonsImage = (e: Entity | undefined): string | null => {
  const file = claimValues(e, 'P18')[0];
  return typeof file === 'string'
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=320`
    : null;
};
// [plain]: sin tildes ni mayúsculas → «cancion» encuentra «Canción»
const plain = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// [pool]: ejecuta `fn` sobre la lista con N a la vez, conservando el orden
async function pool<T, R>(
  items: readonly T[],
  n: number,
  fn: (x: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

@Injectable()
export class WikisourceAdapter {
  private readonly ua: string;
  private readonly retry: RetryOptions = {
    attempts: 3,
    timeoutMs: 8_000,
    baseDelayMs: 1_000,
  };
  // [Limitador]: `nextAt` = cuándo puede salir la siguiente petición · `pausedUntil` = pausa tras un 429 (Retry-After)
  // ponytail: por proceso; con varias réplicas de NestJS, limitador compartido en Redis
  private nextAt = 0;
  private pausedUntil = 0;
  private readonly gap: number;
  private readonly lists = new Map<
    string,
    { at: number; pages: Promise<Page[]> }
  >(); // ponytail: caché en memoria por proceso; Redis si hay varias réplicas

  constructor(config: ConfigService) {
    this.ua =
      config.get<string>('WIKIMEDIA_USER_AGENT') ??
      'AulaDeIdiomas/1.0 (proyecto educativo de idiomas)';
    // `/@|https?:\/\//` (regex): ¿el User-Agent trae un correo o una URL de contacto? (política de User-Agent de Wikimedia)
    this.gap = /@|https?:\/\//.test(this.ua) ? GAP_MS : GAP_NO_CONTACT_MS;
  }

  // [search]: obras de las categorías del género (orden alfabético de Wikisource) → filtro por título → página de 24 con autores de Wikidata
  async search(
    q: BookSearch,
    categories: readonly string[],
  ): Promise<BookCatalogPage> {
    const lang = q.language!;
    const lists = await Promise.all(
      categories.map((c) => this.category(lang, c)),
    );
    // [2026-11-17]: página → género de la categoría donde apareció (se muestra en la tarjeta)
    const genreOf = new Map<number, BookGenre | null>();
    lists.forEach((pages, i) => {
      const g = genreOfCategory(lang, categories[i]);
      for (const p of pages)
        if (!genreOf.has(p.pageid)) genreOf.set(p.pageid, g);
    });
    const seen = new Set<number>();
    const needle = plain(q.search?.trim() ?? '');
    const all = lists
      .flat()
      .filter(
        (p) =>
          !seen.has(p.pageid) &&
          seen.add(p.pageid) &&
          !p.title.includes('/') &&
          (!needle || plain(p.title).includes(needle)),
      );
    const from = (q.page - 1) * PAGE_SIZE;
    const slice = all.slice(from, from + PAGE_SIZE);
    const books = await this.details(lang, slice);
    return {
      books: books.map((b, i) => ({
        ...b,
        genre: genreOf.get(slice[i]?.pageid ?? -1) ?? q.genre ?? null,
      })),
      hasNext: all.length > from + PAGE_SIZE,
    };
  }

  async getById(id: number): Promise<CatalogBook | null> {
    const ref = parseWikisourceId(id);
    if (!ref) return null;
    const r = await this.api<{
      query: { pages: (Page & { missing?: boolean })[] };
    }>(ref.language, { action: 'query', pageids: String(ref.pageid) });
    const page = r.query.pages[0];
    return page && !page.missing
      ? ((await this.details(ref.language, [page]))[0] ?? null)
      : null;
  }

  // [downloadChapters]: página de la obra → si es un índice (muchos enlaces, poco texto) cada enlace es un capítulo; si no, la página es el texto entero
  async downloadChapters(book: CatalogBook): Promise<BookChapter[]> {
    const ref = parseWikisourceId(book.id);
    if (!ref)
      throw new ServiceUnavailableException('No es un libro de Wikisource');
    let title = book.title;
    let html = await this.html(ref.language, title);
    let text = htmlToParagraphs(html);
    // [Fix 2026-11-17 · Páginas de versiones]: poco texto + enlace a una versión con el mismo título → se lee ESA versión (un salto)
    const version =
      text.join('').length < 1500 ? versionLink(html, title) : null;
    if (version) {
      title = version;
      html = await this.html(ref.language, title);
      text = htmlToParagraphs(html);
    }
    // [Fix 2026-11-17]: capítulos = solo subpáginas de la obra («Title/Capítulo I»); antes cualquier enlace (revista, volumen…) contaba como capítulo
    const links = subpageLinks(html, title).slice(0, MAX_CHAPTERS);
    if (links.length < 2) return [{ title: book.title, paragraphs: text }];
    let total = 0;
    const chapters = await pool(links, CONCURRENCY, async (page) => {
      if (total > MAX_TEXT_BYTES) return null; // Tope: el libro no crece sin límite
      const paragraphs = htmlToParagraphs(
        await this.html(ref.language, page).catch(() => ''),
      ); // Un capítulo que falla no tumba el libro
      total += paragraphs.join('').length;
      return { title: page.slice(title.length + 1), paragraphs };
    });
    return chapters.filter(
      (c): c is BookChapter => !!c && c.paragraphs.length > 0,
    );
  }

  // [category]: páginas del espacio principal de una categoría (máx. 1000) · en memoria 6 h
  private category(lang: string, cat: string): Promise<Page[]> {
    const key = `${lang}:${cat}`;
    const hit = this.lists.get(key);
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.pages;
    const pages = (async () => {
      const out: Page[] = [];
      let cont: string | undefined;
      do {
        const r = await this.api<{
          query: { categorymembers: Page[] };
          continue?: { cmcontinue: string };
        }>(lang, {
          action: 'query',
          list: 'categorymembers',
          cmtitle: `Category:${cat}`,
          cmnamespace: '0',
          cmtype: 'page',
          cmlimit: '500',
          ...(cont ? { cmcontinue: cont } : {}),
        });
        out.push(...r.query.categorymembers);
        cont = r.continue?.cmcontinue;
      } while (cont && out.length < MAX_PER_CATEGORY);
      return out;
    })();
    pages.catch(() => this.lists.delete(key)); // Un fallo no se queda en caché
    this.lists.set(key, { at: Date.now(), pages });
    return pages;
  }

  // [details]: ficha de cada obra · 4 peticiones por página de resultados (Wikisource ×2, Wikidata ×2)
  private async details(
    lang: string,
    pages: readonly Page[],
  ): Promise<CatalogBook[]> {
    if (!pages.length) return [];
    const ns = AUTHOR_NS[lang];
    const info = await this.api<{
      query: {
        pages: (Page & {
          pageprops?: { wikibase_item?: string };
          links?: { title: string }[];
        })[];
      };
    }>(lang, {
      action: 'query',
      pageids: pages.map((p) => p.pageid).join('|'),
      prop: ns === undefined ? 'pageprops' : 'pageprops|links',
      ppprop: 'wikibase_item',
      ...(ns === undefined ? {} : { plnamespace: String(ns), pllimit: 'max' }),
    });
    // Autores enlazados como «Autor:…» → su elemento de Wikidata (respaldo si la obra no tiene P50)
    const authorPages = [
      ...new Set(
        info.query.pages.flatMap((p) => (p.links ?? []).map((l) => l.title)),
      ),
    ].slice(0, 50);
    const authorItem = new Map<string, string>();
    if (authorPages.length) {
      const r = await this.api<{
        query: { pages: (Page & { pageprops?: { wikibase_item?: string } })[] };
      }>(lang, {
        action: 'query',
        titles: authorPages.join('|'),
        prop: 'pageprops',
        ppprop: 'wikibase_item',
      });
      for (const p of r.query.pages)
        if (p.pageprops?.wikibase_item)
          authorItem.set(p.title, p.pageprops.wikibase_item);
    }
    const works = await this.entities(
      info.query.pages.flatMap((p) =>
        p.pageprops?.wikibase_item ? [p.pageprops.wikibase_item] : [],
      ),
      lang,
    );
    const authorsOf = new Map<number, string[]>();
    for (const p of info.query.pages) {
      const fromWork = claimIds(works[p.pageprops?.wikibase_item ?? ''], 'P50');
      const fromLinks = (p.links ?? []).flatMap((l) =>
        authorItem.has(l.title) ? [authorItem.get(l.title)!] : [],
      );
      authorsOf.set(
        p.pageid,
        fromWork.length ? fromWork : fromLinks.slice(0, 3),
      );
    }
    const people = await this.entities(
      [...new Set([...authorsOf.values()].flat())],
      lang,
    );
    const byId = new Map(info.query.pages.map((p) => [p.pageid, p]));
    return pages.flatMap((page) => {
      const p = byId.get(page.pageid);
      if (!p) return [];
      const ids = authorsOf.get(page.pageid) ?? [];
      const authors: BookAuthor[] = ids.map((id) => {
        const e = people[id];
        return {
          name: e?.labels?.[lang]?.value ?? e?.labels?.en?.value ?? id,
          birthYear: claimTime(e, 'P569'),
          deathYear: claimTime(e, 'P570'),
        };
      });
      return [
        {
          id: wikisourceId(lang, p.pageid),
          title: p.title,
          authors,
          languages: [lang],
          textUrl: pageUrl(lang, p.title),
          downloadCount: 0,
          source: 'wikisource' as const,
          imageUrl:
            commonsImage(works[p.pageprops?.wikibase_item ?? '']) ??
            commonsImage(people[ids[0] ?? '']),
        },
      ];
    });
  }

  // [entities]: elementos de Wikidata (etiquetas + declaraciones) de 50 en 50
  private async entities(
    ids: readonly string[],
    lang: string,
  ): Promise<Record<string, Entity>> {
    const out: Record<string, Entity> = {};
    for (let i = 0; i < ids.length; i += 50) {
      const r = await this.get<{ entities: Record<string, Entity> }>(
        'https://www.wikidata.org/w/api.php',
        {
          action: 'wbgetentities',
          ids: ids.slice(i, i + 50).join('|'),
          props: 'labels|claims',
          languages: lang === 'en' ? 'en' : `${lang}|en`,
        },
      );
      Object.assign(out, r.entities);
    }
    return out;
  }

  // [html]: SOLO lo usa la descarga (segundo plano) → espera su turno aunque haya pausa
  private async html(lang: string, page: string): Promise<string> {
    const r = await this.api<{ parse?: { text: string } }>(
      lang,
      {
        action: 'parse',
        page,
        prop: 'text',
        redirects: '1',
        disableeditsection: '1',
        disablelimitreport: '1',
      },
      BACKGROUND_WAIT_MS,
    );
    return r.parse?.text ?? '';
  }

  private api<T>(
    lang: string,
    params: Record<string, string>,
    maxWaitMs = FOREGROUND_WAIT_MS,
  ): Promise<T> {
    return this.get<T>(
      `https://${lang}.wikisource.org/w/api.php`,
      params,
      maxWaitMs,
    );
  }

  // [slot]: reserva el turno de la siguiente petición · si tocaría esperar más de `maxWaitMs` → error inmediato (el llamador usa su respaldo)
  private async slot(maxWaitMs: number): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.nextAt, this.pausedUntil);
    if (at - now > maxWaitMs)
      throw new ServiceUnavailableException(
        'Wikisource está ocupado (límite de peticiones); se usa Gutendex',
      );
    this.nextAt = at + this.gap;
    if (at > now) await sleepMs(at - now);
  }

  // [get]: petición con turno + pausa ante 429/5xx (respeta Retry-After) · hasta 4 intentos mientras quepan en `maxWaitMs`
  private async get<T>(
    base: string,
    params: Record<string, string>,
    maxWaitMs = FOREGROUND_WAIT_MS,
  ): Promise<T> {
    const qs = new URLSearchParams({
      ...params,
      format: 'json',
      formatversion: '2',
    });
    let last = 'sin respuesta';
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.slot(maxWaitMs); // Lanza si la espera no cabe → respaldo inmediato
      let res: Response;
      try {
        res = await fetch(`${base}?${qs}`, {
          headers: { 'User-Agent': this.ua, 'Api-User-Agent': this.ua },
          signal: AbortSignal.timeout(this.retry.timeoutMs),
        });
      } catch (err) {
        last = err instanceof Error ? err.message : String(err); // Red caída o tiempo agotado → otro intento
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        // `Number(...) || DEFAULT_PAUSE_S`: Retry-After en segundos (o 1 min) → pausa GLOBAL: nadie más golpea la API mientras tanto
        const after = Number(res.headers.get('retry-after')) || DEFAULT_PAUSE_S;
        this.pausedUntil = Date.now() + after * 1000;
        last = `HTTP ${res.status}`;
        continue;
      }
      if (!res.ok)
        throw new ServiceUnavailableException(
          `Wikisource respondió ${res.status}`,
        );
      const body = (await res.json()) as T & { error?: { info?: string } };
      if (body.error)
        throw new ServiceUnavailableException(
          `Wikisource: ${body.error.info ?? 'error'}`,
        );
      return body;
    }
    throw new ServiceUnavailableException(`Wikisource no responde (${last})`);
  }
}
