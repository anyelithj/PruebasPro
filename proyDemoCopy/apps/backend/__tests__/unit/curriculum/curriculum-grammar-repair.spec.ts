import { applyGrammar, needsGrammar } from '../../../src/modules/vocabulary/application/listeners/curriculum-grammar-repair.listener';

// [2026-11-05 · Corrección automática]: fichas del currículo sin artículo/género/plural/clasificador → se completan sin pisar lo del docente
describe('needsGrammar / applyGrammar', () => {
  it('detecta sustantivos incompletos según el idioma', () => {
    expect(needsGrammar('de', { lemma: 'Tisch', partOfSpeech: 'sustantivo' })).toBe(true);
    expect(needsGrammar('de', { lemma: 'der Tisch', gender: 'masculino', plural: 'die Tische' })).toBe(false);
    expect(needsGrammar('de', { lemma: 'laufen', partOfSpeech: 'verbo' })).toBe(false);
    expect(needsGrammar('zh', { lemma: '书', romanization: 'shū' })).toBe(true);
    expect(needsGrammar('en', { lemma: 'book' })).toBe(false);
  });

  it('completa artículo dentro de la palabra, género y plural', () => {
    const r = { lemma: 'Tisch', headword: '', missing: [], checked: true, grammar: { is_noun: true, article: 'der', gender: 'm' as const, plural: 'Tische', plural_article: 'die' } };
    expect(applyGrammar('de', { lemma: 'Tisch', translationEs: 'mesa' }, r)).toEqual({
      lemma: 'der Tisch', translationEs: 'mesa', partOfSpeech: 'sustantivo', gender: 'masculino', plural: 'die Tische', article: 'der',
    });
  });

  it('no cambia nada si la IA no respondió o no es sustantivo', () => {
    const base = { lemma: 'x', headword: '', missing: [] };
    expect(applyGrammar('de', { lemma: 'x' }, { ...base, checked: false, grammar: { is_noun: true } })).toBeNull();
    expect(applyGrammar('de', { lemma: 'x' }, { ...base, checked: true, grammar: { is_noun: false } })).toBeNull();
  });
});
