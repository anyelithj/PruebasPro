import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  BookTextUseCase,
  type BookIndex,
} from '../../../src/modules/books/application/book-text.use-case';
import type {
  BookView,
  SearchBooksUseCase,
} from '../../../src/modules/books/application/search-books.use-case';
import type { BookCatalogPort } from '../../../src/modules/books/domain/book-catalog.port';
import {
  chapterPage,
  PARAGRAPHS_PER_PAGE,
  sectionsOf,
  splitChapters,
  stripGutenbergBoilerplate,
} from '../../../src/modules/books/domain/gutenberg-text';
import { GutendexAdapter } from '../../../src/modules/books/infrastructure/gutendex.adapter';
// [Spec Texto de libros · RF-146 · 2026-11-14]: limpieza del encabezado y pie de Gutenberg, capítulos en varios idiomas, páginas, frases,
// descarga solo bajo pedido y de UN libro a la vez | Textos de prueba propios y cortos (ningún texto de libro real)

const wrap = (body: string) =>
  `\uFEFFThe Project Gutenberg eBook of Prueba\r\nLicencia de ejemplo.\r\n*** START OF THE PROJECT GUTENBERG EBOOK PRUEBA ***\r\n${body}\r\n*** END OF THE PROJECT GUTENBERG EBOOK PRUEBA ***\r\nMás licencia al final.`;

describe('stripGutenbergBoilerplate', () => {
  it('quita BOM, encabezado y pie', () => {
    expect(stripGutenbergBoilerplate(wrap('Hola mundo.'))).toBe('Hola mundo.');
  });
  it('marca antigua «THIS … EBOOK» y pie «End of the Project Gutenberg EBook»', () => {
    const raw =
      'cabecera\n*** START OF THIS PROJECT GUTENBERG EBOOK X ***\nTexto.\nEnd of the Project Gutenberg EBook of X\nlicencia';
    expect(stripGutenbergBoilerplate(raw)).toBe('Texto.');
  });
  it('sin marcas → el texto entero (no se pierde el libro)', () => {
    expect(stripGutenbergBoilerplate('  Solo texto.  ')).toBe('Solo texto.');
  });
});

describe('splitChapters', () => {
  it('títulos en inglés; la tabla de contenido (títulos sin cuerpo) no cuenta como capítulo', () => {
    const text =
      'Prólogo breve.\n\nCHAPTER I\n\nCHAPTER II\n\nCHAPTER I\n\nUna línea\npartida en dos.\n\nCHAPTER II\n\nOtra parte.';
    const ch = splitChapters(text);
    expect(ch.map((c) => c.title)).toEqual([
      'Inicio',
      'CHAPTER I',
      'CHAPTER II',
    ]);
    expect(ch[1].paragraphs).toEqual(['Una línea partida en dos.']); // Saltos simples de prosa unidos
  });
  it.each([
    ['Chapitre premier', 'fr'],
    ['Kapitel 1', 'de'],
    ['Capítulo uno', 'es'],
    ['Глава первая', 'ru'],
    ['第一章 开始', 'zh'],
  ])('reconoce «%s» (%s)', (title) => {
    const ch = splitChapters(
      `${title}\n\nTexto A.\n\n${title} bis\n\nTexto B.`,
    );
    expect(ch).toHaveLength(2);
    expect(ch[0].title).toBe(title);
  });
  it('sin títulos → partes de tamaño fijo', () => {
    const text = Array.from({ length: 130 }, (_, i) => `Párrafo ${i}.`).join(
      '\n\n',
    );
    expect(splitChapters(text).map((c) => c.title)).toEqual([
      'Parte 1',
      'Parte 2',
      'Parte 3',
    ]);
  });
});

describe('chapterPage', () => {
  it('pagina los párrafos, divide en frases y conserva el índice del párrafo', () => {
    const chapters = [
      {
        title: 'C',
        paragraphs: Array.from(
          { length: PARAGRAPHS_PER_PAGE + 2 },
          (_, i) => `Uno ${i}. Dos ${i}.`,
        ),
      },
    ];
    const p2 = chapterPage(chapters, 0, 2, 'es')!;
    expect(p2.pages).toBe(2);
    expect(p2.paragraphs.map((p) => p.index)).toEqual([
      PARAGRAPHS_PER_PAGE,
      PARAGRAPHS_PER_PAGE + 1,
    ]);
    expect(p2.paragraphs[0].sentences).toEqual([
      `Uno ${PARAGRAPHS_PER_PAGE}.`,
      `Dos ${PARAGRAPHS_PER_PAGE}.`,
    ]);
    expect(chapterPage(chapters, 0, 3, 'es')).toBeNull();
    expect(chapterPage(chapters, 5, 1, 'es')).toBeNull();
  });
});

describe('GutendexAdapter.downloadText', () => {
  const adapter = new GutendexAdapter({
    get: () => undefined,
  } as unknown as ConfigService);
  const view = (textUrl: string) => ({
    id: 1,
    title: 't',
    authors: [],
    languages: ['en'],
    textUrl,
    downloadCount: 0,
  });
  afterEach(() => jest.restoreAllMocks());

  it('solo descarga desde gutenberg.org (evita SSRF)', async () => {
    const f = jest.spyOn(global, 'fetch');
    await expect(
      adapter.downloadText(view('http://169.254.169.254/x.txt')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(f).not.toHaveBeenCalled();
  });

  it('decodifica UTF-8 desde gutenberg.org', async () => {
    const bytes = new TextEncoder().encode('Ñandú y café');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    } as unknown as Response);
    await expect(
      adapter.downloadText(
        view('https://www.gutenberg.org/ebooks/1.txt.utf-8'),
      ),
    ).resolves.toBe('Ñandú y café');
  });

  it('si gutenberg.org responde 503 (bloqueo) usa el espejo oficial', async () => {
    const ok = {
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode('ok').buffer),
    } as unknown as Response;
    const f = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValue(ok);
    await expect(
      adapter.downloadText(
        view('https://www.gutenberg.org/ebooks/1.txt.utf-8'),
      ),
    ).resolves.toBe('ok');
    expect(f).toHaveBeenCalledTimes(2); // 1 intento al origen, sin reintentos
    expect(f.mock.calls[1][0]).toBe(
      'https://gutenberg.pglaf.org/cache/epub/1/pg1.txt',
    );
  });
});

describe('BookTextUseCase · bajo pedido y uno a la vez', () => {
  const book = (id: number): BookView => ({
    id,
    title: `L${id}`,
    authors: [],
    languages: ['en'],
    textUrl: 'https://www.gutenberg.org/x',
    downloadCount: 0,
    attribution: 'PG',
    sourceUrl: 'u',
  });
  const setup = () => {
    let active = 0;
    let maxActive = 0;
    const releases: (() => void)[] = [];
    const downloadText = jest.fn(() => {
      active++;
      maxActive = Math.max(maxActive, active);
      return new Promise<string>((resolve) =>
        releases.push(() => {
          active--;
          resolve(wrap('CHAPTER I\n\nA. B.\n\nCHAPTER II\n\nC.'));
        }),
      );
    });
    const catalog = { downloadText } as unknown as BookCatalogPort;
    const rows = new Map<number, unknown>();
    const texts = {
      findOne: jest.fn(({ where: { bookId } }: { where: { bookId: number } }) =>
        Promise.resolve(rows.get(bookId) ?? null),
      ),
      create: (x: unknown) => x,
      save: jest.fn((x: { bookId: number }) =>
        Promise.resolve(void rows.set(x.bookId, x)).then(() => x),
      ),
    };
    const store = new Map<string, unknown>();
    const cache = {
      get: (k: string) => Promise.resolve(store.get(k)),
      set: (k: string, v: unknown) => Promise.resolve(void store.set(k, v)),
    };
    const books = {
      get: (id: number) => Promise.resolve(book(id)),
    } as unknown as SearchBooksUseCase;
    const uc = new BookTextUseCase(
      catalog,
      cache as never,
      texts as never,
      books,
    );
    const flush = () => new Promise((r) => setImmediate(r));
    return {
      uc,
      download: downloadText,
      releases,
      flush,
      max: () => maxActive,
    };
  };

  it('el mismo libro pedido dos veces → una sola descarga; dos libros → nunca a la vez; luego sale de la BD', async () => {
    const { uc, download, releases, flush, max } = setup();
    const a1 = uc.index(1);
    const a2 = uc.index(1);
    const b = uc.index(2);
    await flush();
    expect(download).toHaveBeenCalledTimes(1); // El libro 2 espera en la cola
    releases.shift()!();
    await flush();
    releases.shift()!();
    const [i1, i1bis, i2] = (await Promise.all([a1, a2, b])) as BookIndex[];
    expect(max()).toBe(1);
    expect(download).toHaveBeenCalledTimes(2);
    expect(i1.chapters.map((c) => c.title)).toEqual([
      'CHAPTER I',
      'CHAPTER II',
    ]);
    expect(i1bis).toEqual(i1);
    expect(i2.level).toBeNull(); // «sin clasificar»
    await uc.page(1, 0, 1);
    expect(download).toHaveBeenCalledTimes(2); // Ya en la BD
  });
});

// [2026-11-17]: «Letter N» dentro de un capítulo → entradas del índice lateral; el índice en una sola línea no cuenta
describe('sectionsOf', () => {
  it('encuentra los títulos de carta con su párrafo', () => {
    const c = {
      title: 'Inicio',
      paragraphs: [
        'Letter 1 Letter 2 Letter 3 Chapter 1',
        'Letter 1',
        'Texto de la carta.',
        'LETTER II.',
        'Más texto.',
      ],
    };
    expect(sectionsOf(c)).toEqual([
      { title: 'Letter 1', paragraph: 1 },
      { title: 'LETTER II', paragraph: 3 },
    ]);
  });
});

// [2026-11-17]: descarga lenta → «preparando» dentro del plazo y el libro sigue bajando en segundo plano
describe('BookTextUseCase · preparación en segundo plano', () => {
  it('si el texto no llega en PREPARE_WAIT_MS responde { preparing } y luego el índice', async () => {
    jest.useFakeTimers();
    let release!: () => void;
    const stored: unknown[] = [];
    const texts = {
      findOne: () => Promise.resolve(stored[0] ?? null),
      create: (x: unknown) => x,
      save: (x: unknown) => (stored.push(x), Promise.resolve(x)),
    };
    const catalog = {
      downloadChapters: () =>
        new Promise((r) => (release = () => r([{ title: 'I', paragraphs: ['Hola.'] }]))),
    } as unknown as BookCatalogPort;
    const books = {
      get: (id: number) => Promise.resolve({ id, languages: ['es'] }),
    } as unknown as SearchBooksUseCase;
    const uc = new BookTextUseCase(catalog, {} as never, texts as never, books);
    const first = uc.index(7);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await first).toMatchObject({ preparing: true });
    release();
    await jest.advanceTimersByTimeAsync(0);
    const ready = (await uc.index(7)) as BookIndex;
    expect(ready.chapters.map((c) => c.title)).toEqual(['I']);
    jest.useRealTimers();
  });
});
