import { BooksCatalogAdapter } from '../../../src/modules/books/infrastructure/books-catalog.adapter';
import type { GutendexAdapter } from '../../../src/modules/books/infrastructure/gutendex.adapter';
import { WikisourceAdapter } from '../../../src/modules/books/infrastructure/wikisource.adapter';
import {
  chapterLinks,
  htmlToParagraphs,
  parseWikisourceId,
  wikisourceCategories,
  wikisourceId,
  yearOf,
} from '../../../src/modules/books/domain/wikisource';
// [Spec Wikisource · Libros · 2026-11-17]: HTML de MediaWiki → texto, índice de capítulos, ids y elección de fuente (Wikisource o Gutendex)
// HTML de prueba propio y corto (misma forma que la salida de action=parse) · ninguna prueba sale a la red

const HTML = `<div class="mw-parser-output">
<div class="ws-noexport"><a href="/wiki/Autor:Rub%C3%A9n_Dar%C3%ADo">Rubén Darío</a> ← <a href="/wiki/Anterior">Anterior</a></div>
<!-- comentario -->
<p><span class="dropinitial"><img alt="A" src="x.jpg" /></span>migo! el cielo está opaco&nbsp;&amp; frío<sup class="reference">[1]</sup>.</p>
<span class="pagenum">39</span>
<div class="poem"><p>Primer verso<br />segundo verso</p></div>
<style>.x{}</style>
<ul><li><a href="/wiki/El_rey_burgu%C3%A9s">El rey burgués</a> 35</li><li><a href="/wiki/La_ninfa">La ninfa</a></li>
<li><a href="/wiki/No_existe" class="new">roto</a></li><li><a href="/wiki/Archivo:x.jpg">img</a></li><li><a href="/wiki/Azul...">yo</a></li></ul>
</div>`;

describe('htmlToParagraphs / chapterLinks', () => {
  it('quita cabecera, notas y números de página; recupera la capitular; cada verso es un párrafo', () => {
    expect(htmlToParagraphs(HTML)).toEqual([
      'Amigo! el cielo está opaco & frío.',
      'Primer verso',
      'segundo verso',
      'El rey burgués 35',
      'La ninfa',
      'roto',
      'img',
      'yo',
    ]);
  });
  it('enlaces del índice en orden, sin espacios con «:», enlaces rojos, cabecera ni la propia página', () => {
    expect(chapterLinks(HTML, 'Azul...')).toEqual([
      'El rey burgués',
      'La ninfa',
    ]);
  });
});

describe('ids y fechas', () => {
  it('id de Wikisource ida y vuelta; los de Gutenberg no lo son', () => {
    const id = wikisourceId('fr', 123456);
    expect(id).toBe(1_200_123_456);
    expect(parseWikisourceId(id)).toEqual({ language: 'fr', pageid: 123456 });
    expect(parseWikisourceId(84)).toBeNull();
  });
  it('año de una fecha de Wikidata', () => {
    expect(yearOf('+1870-12-22T00:00:00Z')).toBe(1870);
    expect(yearOf('-0400-01-01T00:00:00Z')).toBe(-400);
    expect(yearOf(undefined)).toBeNull();
  });
  it('categorías por idioma y género; sin cobertura → []', () => {
    expect(wikisourceCategories('es', 'tale')).toEqual(['Cuentos']);
    expect(wikisourceCategories('es')).toEqual([
      'Cuentos',
      'Novelas',
      'Fábulas',
    ]);
    expect(wikisourceCategories('pt', 'tale')).toEqual([]);
  });
});

describe('BooksCatalogAdapter', () => {
  const page = (id: number) => ({ books: [{ id }] as never, hasNext: false });
  const setup = (ws: Partial<WikisourceAdapter>) => {
    const gutendex = {
      search: jest.fn(() => Promise.resolve(page(84))),
      getById: jest.fn(),
      downloadText: jest.fn(),
    };
    return {
      gutendex,
      c: new BooksCatalogAdapter(
        gutendex as unknown as GutendexAdapter,
        ws as WikisourceAdapter,
      ),
    };
  };

  it('idioma + género con categorías → Wikisource', async () => {
    const search = jest.fn(() => Promise.resolve(page(wikisourceId('es', 1))));
    const { c, gutendex } = setup({ search });
    const r = await c.search({ language: 'es', genre: 'tale', page: 1 });
    expect(search).toHaveBeenCalledWith(
      { language: 'es', genre: 'tale', page: 1 },
      ['Cuentos'],
    );
    expect(r.books[0].id).toBe(1_000_000_001);
    expect(gutendex.search).not.toHaveBeenCalled();
  });
  it('sin cobertura, todos los idiomas, error o sin resultados → Gutendex', async () => {
    const search = jest
      .fn()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce({ books: [], hasNext: false });
    const { c, gutendex } = setup({ search });
    await c.search({ language: 'pt', genre: 'tale', page: 1 });
    await c.search({ page: 1 });
    await c.search({ language: 'es', page: 1 });
    await c.search({ language: 'es', genre: 'novel', page: 1 });
    expect(search).toHaveBeenCalledTimes(2);
    expect(gutendex.search).toHaveBeenCalledTimes(4);
  });
  it('abrir: el id decide la fuente', async () => {
    const getById = jest.fn(() => Promise.resolve(null));
    const { c, gutendex } = setup({ getById });
    await c.getById(wikisourceId('de', 5));
    await c.getById(84);
    expect(getById).toHaveBeenCalledWith(1_300_000_005);
    expect(gutendex.getById).toHaveBeenCalledWith(84);
  });
});

// [2026-11-17]: páginas de versiones («"Through"») y capítulos solo como subpáginas · género por categoría
import {
  genreOfCategory,
  subpageLinks,
  versionLink,
} from '../../../src/modules/books/domain/wikisource';
describe('versiones, subpáginas y género', () => {
  const html =
    '<p>Versions of <a href="/wiki/Author:E._F._Benson">Benson</a>:</p><ul>' +
    '<li><a href="/wiki/Century_Magazine/Volume_94/Issue_3/%22Through%22">Century</a></li>' +
    '<li><a href="/wiki/Century_Magazine">Century Magazine</a></li></ul>';
  it('versionLink sigue la versión con el mismo título', () => {
    expect(versionLink(html, '"Through"')).toBe('Century Magazine/Volume 94/Issue 3/"Through"');
    expect(versionLink('<p>texto</p>', 'X')).toBeNull();
  });
  it('subpageLinks ignora revista, volumen y autor', () => {
    const idx = '<a href="/wiki/Libro/I">I</a><a href="/wiki/Libro/II">II</a><a href="/wiki/Revista">R</a>';
    expect(subpageLinks(idx, 'Libro')).toEqual(['Libro/I', 'Libro/II']);
  });
  it('genreOfCategory', () => {
    expect(genreOfCategory('es', 'Cuentos')).toBe('tale');
    expect(genreOfCategory('de', 'Märchen')).toBe('fairy');
    expect(genreOfCategory('es', 'Nada')).toBeNull();
  });
});

// [2026-11-17 · HTTP 429]: tras un 429 con Retry-After la búsqueda NO espera: falla al instante (entra Gutendex) y no repite la petición
describe('WikisourceAdapter · límite de peticiones', () => {
  const realFetch = global.fetch;
  afterEach(() => (global.fetch = realFetch));
  it('429 → pausa global y error inmediato en primer plano', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
      headers: { get: (h: string) => (h === 'retry-after' ? '30' : null) },
    });
    global.fetch = fetchMock as never;
    const ws = new WikisourceAdapter({ get: () => undefined } as never);
    const started = Date.now();
    await expect(ws.getById(1_100_000_123)).rejects.toThrow(/ocupado|no responde/);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
