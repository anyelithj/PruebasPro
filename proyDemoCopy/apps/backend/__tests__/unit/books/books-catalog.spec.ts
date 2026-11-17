import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SearchBooksUseCase } from '../../../src/modules/books/application/search-books.use-case';
import {
  isPublicDomainCO,
  lastFreeDeathYear,
  pickPlainTextUrl,
  visibleBooks,
  type CatalogBook,
} from '../../../src/modules/books/domain/book';
import {
  fetchWithRetry,
  GutendexAdapter,
} from '../../../src/modules/books/infrastructure/gutendex.adapter';
// [Spec Catálogo de libros · RF-145 · 2026-11-14]: filtro de autores (Colombia, vida + 80), idioma, texto plano, reintentos y caché
// Gutendex SIEMPRE simulado (fetch falso) → ninguna prueba llama a la API real | Datos de prueba inventados y cortos (sin textos de libros)

const author = (deathYear: number | null) => ({
  name: 'Autora Prueba',
  birthYear: 1800,
  deathYear,
});
const book = (over: Partial<CatalogBook> = {}): CatalogBook => ({
  id: 1,
  title: 'Libro de prueba',
  authors: [author(1900)],
  languages: ['en'],
  textUrl: 'https://x/1.txt',
  downloadCount: 5,
  ...over,
});
const json = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;
const gutendexBook = (id: number, death: number | null, lang = 'en') => ({
  id,
  title: `T${id}`,
  authors: [{ name: 'A', birth_year: 1800, death_year: death }],
  languages: [lang],
  formats: {
    'text/plain; charset=us-ascii': `https://x/${id}.txt`,
    'text/plain; charset=utf-8': `https://x/${id}.utf8.txt`,
    'application/zip': 'https://x/z.zip',
  },
  download_count: 1,
});

describe('dominio · filtro de dominio público y de idioma', () => {
  it('2026 → autores fallecidos hasta 1945 (antes de 1946)', () =>
    expect(lastFreeDeathYear(2026)).toBe(1945));

  it('todos los autores con fecha de muerte ≤ límite; sin fecha o sin autores → no se muestra', () => {
    expect(isPublicDomainCO([author(1945)], 2026)).toBe(true);
    expect(isPublicDomainCO([author(1946)], 2026)).toBe(false);
    expect(isPublicDomainCO([author(1900), author(null)], 2026)).toBe(false);
    expect(isPublicDomainCO([], 2026)).toBe(false);
  });

  it('idioma pedido o, sin filtro, uno de los 7; sin texto plano → fuera', () => {
    const all = [
      book({ id: 1 }),
      book({ id: 2, languages: ['la'] }),
      book({ id: 3, textUrl: null }),
      book({ id: 4, languages: ['fr'] }),
    ];
    expect(visibleBooks(all, 2026).map((b) => b.id)).toEqual([1, 4]);
    expect(visibleBooks(all, 2026, 'fr').map((b) => b.id)).toEqual([4]);
  });

  it('elige texto plano UTF-8 y nunca un .zip', () => {
    expect(
      pickPlainTextUrl({
        'text/plain; charset=us-ascii': 'a.txt',
        'text/plain; charset=utf-8': 'b.txt',
      }),
    ).toBe('b.txt');
    expect(
      pickPlainTextUrl({ 'text/plain': 'c.zip', 'text/html': 'd.html' }),
    ).toBeNull();
  });
});

describe('fetchWithRetry', () => {
  afterEach(() => jest.restoreAllMocks());
  const opts = { attempts: 3, timeoutMs: 1000, baseDelayMs: 1 };

  it('reintenta 503 y red caída; devuelve el primer éxito', async () => {
    const f = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({}, 503))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(json({ ok: 1 }));
    expect((await fetchWithRetry('https://g/books', opts)).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('no reintenta un 404 y se rinde tras N intentos fallidos', async () => {
    const f = jest.spyOn(global, 'fetch').mockResolvedValue(json({}, 404));
    expect((await fetchWithRetry('https://g/books/9', opts)).status).toBe(404);
    expect(f).toHaveBeenCalledTimes(1);
    f.mockResolvedValue(json({}, 500));
    await expect(
      fetchWithRetry('https://g/books', opts),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('integración · SearchBooksUseCase + GutendexAdapter (Gutendex simulado)', () => {
  const config = {
    get: (k: string) =>
      k === 'GUTENDEX_BASE_URL' ? 'https://mi-gutendex.local/' : undefined,
  } as unknown as ConfigService;
  const setup = () => {
    const store = new Map<string, unknown>();
    const cache = {
      get: jest.fn((k: string) => Promise.resolve(store.get(k))),
      set: jest.fn((k: string, v: unknown) =>
        Promise.resolve(void store.set(k, v)),
      ),
    };
    const rows = new Map<number, CatalogBook>();
    const repo = {
      create: (b: CatalogBook) => b,
      save: jest.fn((list: CatalogBook | CatalogBook[]) =>
        Promise.resolve([list].flat().forEach((b) => rows.set(b.id, b))),
      ),
      findOne: jest.fn(({ where: { id } }: { where: { id: number } }) =>
        Promise.resolve(rows.get(id) ?? null),
      ),
    };
    const uc = new SearchBooksUseCase(
      new GutendexAdapter(config),
      cache as never,
      repo as never,
    );
    return { uc, cache, repo, rows };
  };
  afterEach(() => jest.restoreAllMocks());

  it('usa la URL configurada, filtra, guarda en BD, cachea en Redis y la segunda búsqueda no sale a la red', async () => {
    const f = jest.spyOn(global, 'fetch').mockResolvedValue(
      json({
        next: 'p2',
        results: [
          gutendexBook(10, 1890, 'de'),
          gutendexBook(11, 1960, 'de'),
          { ...gutendexBook(12, 1890, 'de'), copyright: true }, // [2026-11-16]: protegido en EE. UU. → se filtra localmente
        ],
      }),
    );
    const { uc, repo, rows } = setup();
    const now = new Date('2026-11-14');
    const r = await uc.search(
      { search: 'Kafka', language: 'de', page: 1 },
      now,
    );
    expect(f.mock.calls[0][0] as string).toBe(
      'https://mi-gutendex.local/books/?page=1&search=Kafka&languages=de',
    );
    expect(r.books.map((b) => b.id)).toEqual([10]); // 1960 > 1945 → fuera
    expect(r.books[0]).toMatchObject({
      textUrl: 'https://x/10.utf8.txt',
      sourceUrl: 'https://www.gutenberg.org/ebooks/10',
    });
    expect(r.books[0].attribution).toMatch(/Project Gutenberg/);
    expect(r.hasNext).toBe(true);
    expect(rows.has(10)).toBe(true);
    await uc.search({ search: ' kafka ', language: 'de', page: 1 }, now); // misma clave normalizada
    expect(f).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // [2026-11-17]: género → `topic` de Gutendex (novela = fiction, cuento = short stories…)
  it('género: envía el topic de Gutendex y lo separa en la caché', async () => {
    const f = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(json({ next: null, results: [] })),
      );
    const { uc } = setup();
    await uc.search({ language: 'en', genre: 'tale', page: 1 });
    await uc.search({ language: 'en', page: 1 });
    expect(f.mock.calls[0][0] as string).toBe(
      'https://mi-gutendex.local/books/?page=1&languages=en&topic=short+stories',
    );
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('get: de la BD sin red; si no está, una sola petición; protegido → 404', async () => {
    const { uc, rows } = setup();
    rows.set(7, book({ id: 7 }));
    const f = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json(gutendexBook(8, 2001)));
    expect((await uc.get(7)).id).toBe(7);
    expect(f).not.toHaveBeenCalled();
    await expect(uc.get(8)).rejects.toBeInstanceOf(NotFoundException);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
