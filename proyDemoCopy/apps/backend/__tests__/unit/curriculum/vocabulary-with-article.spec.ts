import { Language } from '../../../src/shared/domain/language.vo';
import { withArticle } from '../../../src/modules/curriculum/application/queries/ai-draft.queries';

// [2026-11-05 · Regla de vocabulario]: el sustantivo se guarda con su artículo (der Tisch, l'école) sin inventar nada
describe('withArticle', () => {
  const run = (language: Language, d: Record<string, unknown>) => (withArticle(language, d), d);

  it('antepone el artículo singular a la palabra', () => {
    expect(run(Language.DE, { lemma: 'Tisch', article: 'der' }).lemma).toBe('der Tisch');
    expect(run(Language.FR, { lemma: 'école', article: "l'" }).lemma).toBe("l'école");
  });

  it('con el artículo ya escrito, rellena `article` y no lo duplica', () => {
    expect(run(Language.ES, { lemma: 'el libro' })).toEqual({ lemma: 'el libro', article: 'el' });
  });

  it('no toca artículos de plural, inválidos ni idiomas sin artículo', () => {
    expect(run(Language.FR, { lemma: 'livre', article: 'les' }).lemma).toBe('livre');
    expect(run(Language.DE, { lemma: 'Tisch', article: 'le' }).lemma).toBe('Tisch');
    expect(run(Language.RU, { lemma: 'стол', article: '' }).lemma).toBe('стол');
  });
});

// [2026-11-06 · Regla obligatoria]: sin artículo pero con género → artículo deducido · término suelto (juegos/políglota) con artículo
import { termWithArticle } from '../../../src/modules/curriculum/domain/content/vocabulary-grammar';
const run = (language: Language, d: Record<string, unknown>) => (withArticle(language, d), d);
describe('artículo deducido y términos sueltos', () => {
  it('género → artículo (de, fr con l\', es)', () => {
    expect(run(Language.DE, { lemma: 'Tisch', gender: 'masculino' })).toMatchObject({ lemma: 'der Tisch', article: 'der' });
    expect(run(Language.FR, { lemma: 'école', gender: 'femenino' }).lemma).toBe("l'école");
    expect(run(Language.ES, { lemma: 'mesa', gender: 'f' }).lemma).toBe('la mesa');
  });
  it('termWithArticle', () => {
    const r = (grammar: Record<string, unknown>, lemma = 'Mutter') => ({ lemma, grammar: { is_noun: true, ...grammar }, headword: '', missing: [], checked: true });
    expect(termWithArticle('de', 'Mutter', r({ article: 'die', gender: 'f' }))).toBe('die Mutter');
    expect(termWithArticle('de', 'Kind', r({ gender: 'n' }, 'Kind'))).toBe('das Kind');
    expect(termWithArticle('de', 'die Mutter', null)).toBe('die Mutter');
    expect(termWithArticle('en', 'water', r({ countable: false, article: '' }, 'water'))).toBe('water');
    expect(termWithArticle('en', 'apple', r({ countable: true, article: 'an' }, 'apple'))).toBe('an apple');
    expect(termWithArticle('de', 'laufen', { lemma: 'laufen', grammar: { is_noun: false }, headword: '', missing: [], checked: true })).toBe('laufen');
  });
});
