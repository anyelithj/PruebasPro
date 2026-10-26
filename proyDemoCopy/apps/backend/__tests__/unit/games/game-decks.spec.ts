// [Spec GameDecks · 2026-10-25]: limpieza de las palabras de un juego con material propio (también filtra la salida del LLM) + ruta de borrador con el timeout largo
import {
  cleanItems,
  MAX_DECK_ITEMS,
} from '../../../src/modules/games/application/use-cases/game-decks.use-case';
import { LONG_TIMEOUT_PATTERNS } from '../../../src/shared/interceptors/timeout.interceptor';

describe('cleanItems', () => {
  it('quita vacíos y duplicados (sin mayúsculas), recorta y conserva solo campos con texto', () => {
    expect(
      cleanItems([
        { term: ' Apple ', translation: 'manzana', emoji: '' },
        { term: 'apple' },
        { term: '' },
        null,
        { term: 'car', category: 'things' },
      ]),
    ).toEqual([
      { term: 'Apple', translation: 'manzana' },
      { term: 'car', category: 'things' },
    ]);
  });
  it('acepta basura del LLM sin romperse y respeta el máximo', () => {
    expect(cleanItems('nope')).toEqual([]);
    expect(
      cleanItems(Array.from({ length: 100 }, (_, i) => ({ term: `w${i}` }))),
    ).toHaveLength(MAX_DECK_ITEMS);
  });
});

describe('timeout de rutas IA', () => {
  it.each([
    '/api/v1/music/lyrics/draft',
    '/api/v1/polyglot/topics/1/draft',
    '/api/v1/games/decks/draft',
    '/api/v1/grammar/topics/1/enrich',
  ])('%s usa el timeout largo', (url) => {
    expect(LONG_TIMEOUT_PATTERNS.some((re) => re.test(url))).toBe(true);
  });
  it('una ruta normal no', () =>
    expect(
      LONG_TIMEOUT_PATTERNS.some((re) => re.test('/api/v1/music/songs')),
    ).toBe(false));
});
