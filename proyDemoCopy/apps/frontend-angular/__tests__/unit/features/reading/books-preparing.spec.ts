import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BooksFacade } from '@features/reading/application/books.facade';
import { BooksRepository } from '@features/reading/domain/books.repository.port';
import { coverFallback, type BookIndex } from '@features/reading/domain/models/book';
// [Spec Libros · 2026-11-17]: libro que el servidor aún descarga ({ preparing }) → la fachada vuelve a preguntar · salir corta el sondeo
// misma búsqueda al volver a la lista → no se repite · portada de gutenberg.org caída → espejo oficial

const book = { id: 7, title: 'Libro', authors: [], languages: ['en'], attribution: 'PG', sourceUrl: '', source: 'gutenberg' as const, imageUrl: null, genre: 'tale' };
const index: BookIndex = { book, language: 'en', level: null, chapters: [{ index: 0, title: 'Uno', paragraphs: 1, sections: [] }] };
const page = { chapter: 0, title: 'Uno', page: 1, pages: 1, paragraphs: [{ index: 0, sentences: ['Hi.'] }] };

function setup(openReplies: unknown[]) {
  const repo = {
    open: jest.fn(() => of(openReplies.shift())),
    progress: jest.fn(() => of(null)),
    page: jest.fn(() => of(page)),
    search: jest.fn(() => of({ books: [], page: 1, hasNext: false })),
  };
  TestBed.configureTestingModule({ providers: [BooksFacade, { provide: BooksRepository, useValue: repo }] });
  return { facade: TestBed.inject(BooksFacade), repo };
}

describe('BooksFacade · libro en preparación', () => {
  afterEach(() => jest.useRealTimers());

  it('{ preparing } → avisa y vuelve a preguntar hasta tener el índice', async () => {
    jest.useFakeTimers();
    const { facade, repo } = setup([{ book, preparing: true }, index]);
    const opening = facade.open(7);
    await jest.advanceTimersByTimeAsync(0);
    expect(facade.preparing()).toBe(true);
    await jest.advanceTimersByTimeAsync(5_000);
    await opening;
    expect(repo.open).toHaveBeenCalledTimes(2);
    expect(facade.preparing()).toBe(false);
    expect(facade.lines().map((l) => l.text)).toEqual(['Hi.']);
  });

  it('dispose (salir del lector) corta el sondeo', async () => {
    jest.useFakeTimers();
    const { facade, repo } = setup([{ book, preparing: true }, index]);
    const opening = facade.open(7);
    await jest.advanceTimersByTimeAsync(0);
    facade.dispose();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await opening).toBeNull();
    expect(repo.open).toHaveBeenCalledTimes(1);
    expect(facade.index()).toBeNull();
  });

  it('volver a la lista con la misma búsqueda no la repite', async () => {
    const { facade, repo } = setup([]);
    await facade.search({ language: 'es', page: 1 });
    await facade.search({ language: 'es', page: 1 });
    await facade.search({ language: 'de', page: 1 });
    expect(repo.search).toHaveBeenCalledTimes(2);
  });
});

describe('coverFallback', () => {
  it('gutenberg.org → espejo; otras fuentes → null', () => {
    expect(coverFallback('https://www.gutenberg.org/cache/epub/2000/pg2000.cover.medium.jpg')).toBe('https://gutenberg.pglaf.org/cache/epub/2000/pg2000.cover.medium.jpg');
    expect(coverFallback('https://gutenberg.pglaf.org/cache/epub/2000/pg2000.cover.medium.jpg')).toBeNull();
    expect(coverFallback('https://commons.wikimedia.org/wiki/Special:FilePath/x.jpg')).toBeNull();
  });
});
