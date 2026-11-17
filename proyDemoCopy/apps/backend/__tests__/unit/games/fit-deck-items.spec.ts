import { fitDeckItems, lemma } from '../../../src/modules/games/application/use-cases/game-decks.use-case';
// [Spec fitDeckItems · 2026-11-16]: caso real «Los alimentos» en alemán → español con artículo alemán, huevo/huevos y categorías sueltas

describe('fitDeckItems', () => {
  const raw = [
    { term: 'das huevo', translation: 'huevos', emoji: '🥚', category: 'frutas y verduras' },
    { term: 'die zanahoria', translation: 'zanahorias', emoji: '🥕', category: 'verduras' },
    { term: 'das Ei', translation: 'el huevo', emoji: '🥚', category: 'x' },
    { term: 'die Eier', translation: 'los huevos', emoji: '🥚', category: 'x' },
    { term: 'das Brot', translation: 'el pan', emoji: '🥖', category: 'comida principal' },
    { term: 'das Wasser', translation: 'el agua', emoji: '💧', category: 'bebidas' },
  ];

  it('quita el español disfrazado y los repetidos; la categoría pasa a ser el tema', () => {
    expect(fitDeckItems(raw, 'de', 'Los alimentos', 'memory')).toEqual([
      { term: 'das Ei', translation: 'el huevo', emoji: '🥚', category: 'Los alimentos' },
      { term: 'das Brot', translation: 'el pan', emoji: '🥖', category: 'Los alimentos' },
      { term: 'das Wasser', translation: 'el agua', emoji: '💧', category: 'Los alimentos' },
    ]);
  });

  it('«Clasificación rápida» conserva los subgrupos; «agua» no pierde la «a»', () => {
    expect(fitDeckItems(raw, 'de', 'Los alimentos', 'quick_sort').map((i) => i.category)).toEqual(['x', 'comida principal', 'bebidas']);
    expect(lemma('el agua')).toBe('agua');
    expect(lemma('las frutas')).toBe('fruta');
  });
});

// [2026-11-16 · Regla obligatoria de vocabulario]: nota gramatical de Poliglota
import { grammarNote } from '../../../src/modules/curriculum/domain/content/vocabulary-grammar';
describe('grammarNote', () => {
  const r = (grammar: Record<string, unknown>) => ({ lemma: 'x', headword: 'x', missing: [], checked: true, grammar: { is_noun: true, ...grammar } }) as never;
  it('alemán: género y plural · chino: clasificador con pinyin · inglés: incontable', () => {
    expect(grammarNote('de', r({ gender: 'm', plural: 'Tische', plural_article: 'die' }))).toBe('masculino · pl. die Tische');
    expect(grammarNote('zh', r({ measure_example: '一张桌子', pinyin: 'yì zhāng zhuōzi' }))).toBe('一张桌子 (yì zhāng zhuōzi)');
    expect(grammarNote('en', r({ countable: false }))).toBe('incontable');
    expect(grammarNote('de', null)).toBe('');
  });
});
