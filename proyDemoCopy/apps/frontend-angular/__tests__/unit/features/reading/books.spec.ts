import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BooksFacade, browserTranslator } from '@features/reading/application/books.facade';
import { BooksRepository } from '@features/reading/domain/books.repository.port';
import { activeEntry, authorsLabel, tocEntries, chapterProgress, lineIndexOf, linesOf, pageOfParagraph, type BookIndex, type ChapterPage } from '@features/reading/domain/models/book';
// [Spec Libros · RF-145/146/147 · 2026-11-16]: funciones puras del lector, Translator API → servidor, retomar progreso y carga progresiva
// [Datos]: texto propio corto (nunca texto de libros) | [Patrón]: Test Double del repositorio (sin red ni Gutendex)

const page = (n: number, pages: number, first: number): ChapterPage => ({
  chapter: 0,
  title: 'Uno',
  page: n,
  pages,
  paragraphs: [
    { index: first, sentences: ['A fox runs.', 'It stops.'] },
    { index: first + 1, sentences: ['The end.'] },
  ],
});

const index: BookIndex = {
  book: { id: 7, title: 'Libro', authors: [{ name: 'Ana', birthYear: 1800, deathYear: 1870 }], languages: ['en'], attribution: 'Project Gutenberg', sourceUrl: 'https://www.gutenberg.org/ebooks/7' },
  language: 'en',
  level: null,
  chapters: [{ index: 0, title: 'Uno', paragraphs: 40, sections: [] }],
};

describe('modelo de libro', () => {
  it('linesOf aplana párrafos y frases con su posición', () => {
    const lines = linesOf([page(1, 1, 0)]);
    expect(lines.map((l) => [l.paragraph, l.sentence, l.text])).toEqual([
      [0, 0, 'A fox runs.'],
      [0, 1, 'It stops.'],
      [1, 0, 'The end.'],
    ]);
    expect(lineIndexOf(lines, { paragraph: 1, sentence: 0 })).toBe(2);
    expect(lineIndexOf(lines, { paragraph: 9, sentence: 0 })).toBe(0); // Ya no existe → inicio
  });

  it('página del párrafo, progreso del capítulo y autores', () => {
    expect(pageOfParagraph(0)).toBe(1);
    expect(pageOfParagraph(20)).toBe(2);
    expect(chapterProgress(9, 20)).toBe(50);
    expect(chapterProgress(0, 0)).toBe(0);
    expect(authorsLabel(index.book)).toBe('Ana (1800–1870)');
  });
});

describe('browserTranslator', () => {
  it('sin API o par no disponible → null (servidor); disponible → traductor', async () => {
    expect(await browserTranslator('en', 'es', {})).toBeNull();
    const unavailable = { Translator: { availability: async () => 'unavailable', create: jest.fn() } };
    expect(await browserTranslator('en', 'es', unavailable)).toBeNull();
    const t = { translate: async (s: string) => `es:${s}` };
    expect(await browserTranslator('en', 'es', { Translator: { availability: async () => 'available', create: async () => t } })).toBe(t);
  });
});

describe('BooksFacade', () => {
  function setup(progress: unknown = of(null)) {
    const repo = {
      search: jest.fn(),
      open: jest.fn(() => of(index)),
      page: jest.fn((_id: number, _c: number, n: number) => of(page(n, 2, (n - 1) * 20))),
      translate: jest.fn(() => of({ translation: 'Un zorro corre.' })),
      ipa: jest.fn(),
      progress: jest.fn(() => progress),
      saveProgress: jest.fn((_id: number, p: unknown) => of(p)),
    };
    TestBed.configureTestingModule({ providers: [BooksFacade, { provide: BooksRepository, useValue: repo }] });
    return { facade: TestBed.inject(BooksFacade), repo };
  }

  it('retoma en la página del párrafo guardado (solo esa página)', async () => {
    const { facade, repo } = setup(of({ chapter: 0, paragraph: 21, sentence: 0 }));
    const pos = await facade.open(7);
    expect(pos).toEqual({ chapter: 0, paragraph: 21, sentence: 0 });
    expect(repo.page).toHaveBeenCalledTimes(1);
    expect(repo.page).toHaveBeenCalledWith(7, 0, 2);
  });

  it('sin progreso (o error al leerlo) empieza en la página 1 y carga más bajo pedido', async () => {
    const { facade, repo } = setup(throwError(() => new Error('401')));
    expect(await facade.open(7)).toBeNull();
    expect(repo.page).toHaveBeenCalledWith(7, 0, 1);
    expect(await facade.loadMore()).toBe(true);
    expect(facade.lines()).toHaveLength(6);
    expect(await facade.loadMore()).toBe(false); // Era la última página
  });

  it('traduce un párrafo una sola vez (servidor si el navegador no tiene Translator API)', async () => {
    const { facade, repo } = setup();
    await facade.open(7);
    await facade.translate(0, 'A fox runs.');
    await facade.translate(0, 'A fox runs.');
    expect(repo.translate).toHaveBeenCalledTimes(1);
    expect(facade.translations()[0]).toBe('Un zorro corre.');
  });

  it('guarda el progreso solo si cambia la posición', async () => {
    const { facade, repo } = setup();
    await facade.open(7);
    const [a, b] = facade.lines();
    await facade.saveProgress(a);
    await facade.saveProgress(a);
    await facade.saveProgress(b);
    expect(repo.saveProgress).toHaveBeenCalledTimes(2);
  });
});

// [2026-11-17]: índice lateral — cartas dentro de «Inicio» como entradas propias y entrada activa según el párrafo
describe('tocEntries / activeEntry', () => {
  const chapters = [
    { index: 0, title: 'Inicio', paragraphs: 30, sections: [{ title: 'Letter 1', paragraph: 3 }, { title: 'Letter 2', paragraph: 12 }] },
    { index: 1, title: 'Chapter 1', paragraphs: 20, sections: [] },
  ];
  it('lista capítulos y cartas en orden', () => {
    expect(tocEntries(chapters).map((e) => e.title)).toEqual(['Inicio', 'Letter 1', 'Letter 2', 'Chapter 1']);
  });
  it('la entrada activa es la última que empieza antes del párrafo', () => {
    const e = tocEntries(chapters);
    expect(activeEntry(e, 0, 5)).toBe(1);
    expect(activeEntry(e, 0, 12)).toBe(2);
    expect(activeEntry(e, 1, 0)).toBe(3);
  });
});
