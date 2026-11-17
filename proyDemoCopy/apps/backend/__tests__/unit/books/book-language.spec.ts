import { NotFoundException } from '@nestjs/common';
import { BookLanguageUseCase } from '../../../src/modules/books/application/book-language.use-case';
import { BookProgressUseCase } from '../../../src/modules/books/application/book-progress.use-case';
import type { BookTextUseCase } from '../../../src/modules/books/application/book-text.use-case';
import { translationChunks } from '../../../src/modules/books/domain/gutenberg-text';
import type { LanguageToolsPort } from '../../../src/shared/domain/interfaces/language-tools.interface';
// [Spec Traducción, IPA y progreso de libros · RF-146/RF-147 · 2026-11-14]: por párrafo y bajo demanda, con el párrafo anterior como contexto,
// caché por (libro, capítulo, párrafo, idioma); IPA de UNA frase con caché; progreso con upsert | Textos propios y cortos

describe('translationChunks', () => {
  it('agrupa frases enteras hasta el máximo y corta sin perder texto lo que no cabe', () => {
    expect(translationChunks(['Uno.', 'Dos.', 'Tres.'], 9)).toEqual([
      'Uno. Dos.',
      'Tres.',
    ]);
    const zh = '一二三四五六七';
    expect(translationChunks([zh], 3).join('').replace(/\s/g, '')).toBe(zh);
    expect(translationChunks([zh], 3).every((c) => c.length <= 3)).toBe(true);
  });
});

describe('BookLanguageUseCase', () => {
  const setup = (language = 'en', text = 'First line. Second line.') => {
    const translate = jest.fn((t: string) =>
      Promise.resolve({ translation: `ES(${t})` }),
    );
    const ipa = jest.fn((t: string) =>
      Promise.resolve({ ipa: `/${t}/`, ipa_us: null, engine: 'espeak-ng' }),
    );
    const tools = { translate, ipa } as unknown as LanguageToolsPort;
    const paragraph = jest.fn((_b: number, _c: number, index: number) =>
      index > 5
        ? Promise.reject(new NotFoundException())
        : Promise.resolve({ language, text, previous: 'Previous paragraph.' }),
    );
    const bookText = { paragraph } as unknown as BookTextUseCase;
    const rows: Record<string, unknown>[] = [];
    const repo = {
      findOne: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          rows.find((r) =>
            Object.entries(where).every(([k, v]) => r[k] === v),
          ) ?? null,
        ),
      create: (x: Record<string, unknown>) => x,
      save: (x: Record<string, unknown>) =>
        Promise.resolve(void rows.push(x)).then(() => x),
    };
    const store = new Map<string, unknown>();
    const cache = {
      get: (k: string) => Promise.resolve(store.get(k)),
      set: (k: string, v: unknown) => Promise.resolve(void store.set(k, v)),
    };
    const uc = new BookLanguageUseCase(
      bookText,
      tools,
      cache as never,
      repo as never,
    );
    return { uc, translate, ipa, paragraph };
  };

  it('traduce el párrafo con el anterior como contexto y no vuelve a llamar al LLM', async () => {
    const { uc, translate } = setup();
    await expect(uc.translate(1, 0, 2, 'tok')).resolves.toEqual({
      translation: 'ES(First line. Second line.)',
    });
    expect(translate).toHaveBeenCalledWith(
      'First line. Second line.',
      'en',
      'es',
      'tok',
      { kind: 'frase', context: 'Previous paragraph.' },
    );
    await uc.translate(1, 0, 2, 'tok');
    expect(translate).toHaveBeenCalledTimes(1); // Caché por (libro, capítulo, párrafo, idioma)
  });

  it('libro en español → sin traducción ni llamada', async () => {
    const { uc, translate } = setup('es');
    await expect(uc.translate(1, 0, 0, 't')).resolves.toEqual({
      translation: null,
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it('IPA de UNA frase (misma división que la página), cacheado; fuera de rango → 404', async () => {
    const { uc, ipa } = setup();
    await expect(uc.sentenceIpa(1, 0, 0, 1, 't')).resolves.toEqual({
      ipa: '/Second line./',
      ipa_us: null,
      parts: [{ text: 'Second line.', ipa: '/Second line./' }], // [2026-11-16]: renglones con su IPA
    });
    await uc.sentenceIpa(1, 0, 0, 1, 't');
    expect(ipa).toHaveBeenCalledTimes(1);
    await expect(uc.sentenceIpa(1, 0, 0, 9, 't')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('BookProgressUseCase', () => {
  it('upsert por (usuario, libro) y lectura para retomar', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const repo = {
      upsert: jest.fn((x: Record<string, unknown>) =>
        Promise.resolve(
          void rows.set(`${x.userId as string}:${x.bookId as number}`, x),
        ),
      ),
      findOne: ({
        where: { userId, bookId },
      }: {
        where: { userId: string; bookId: number };
      }) => Promise.resolve(rows.get(`${userId}:${bookId}`) ?? null),
    };
    const uc = new BookProgressUseCase(repo as never);
    expect(await uc.get('u1', 5)).toBeNull();
    await uc.save('u1', 5, { chapter: 2, paragraph: 7, sentence: 1 });
    await uc.save('u1', 5, { chapter: 3, paragraph: 0, sentence: 0 });
    expect(await uc.get('u1', 5)).toEqual({
      chapter: 3,
      paragraph: 0,
      sentence: 0,
    });
    expect(repo.upsert).toHaveBeenLastCalledWith(
      { userId: 'u1', bookId: 5, chapter: 3, paragraph: 0, sentence: 0 },
      ['userId', 'bookId'],
    );
  });
});
