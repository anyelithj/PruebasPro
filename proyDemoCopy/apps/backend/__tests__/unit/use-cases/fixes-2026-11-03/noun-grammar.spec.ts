import { CompleteGrammarUseCase } from '../../../../src/modules/vocabulary/application/use-cases/complete-grammar.use-case';
import type { VocabularyEntry } from '../../../../src/modules/vocabulary/domain/entities/vocabulary-entry.entity';
import { applyManualGrammar, isGrammarComplete, missingGrammar } from '../../../../src/modules/vocabulary/domain/noun-grammar';
import type { LanguageToolsPort } from '../../../../src/shared/domain/interfaces/language-tools.interface';
// [Suite 2026-11-03 · Regla obligatoria de vocabulario]: artículo/género/plural por idioma + reparación de entradas incompletas

describe('NounGrammar (dominio)', () => {
  it('edición manual: artículo derivado del género y «l\'» ante vocal', () => {
    expect(applyManualGrammar('de', 'Lampe', null, { gender: 'f', plural: 'Lampen' }).headword).toBe('die Lampe – die Lampen');
    expect(applyManualGrammar('fr', 'école', null, { gender: 'f', plural: 'écoles' }).headword).toBe("l'école – les écoles");
    expect(applyManualGrammar('pt', 'livro', null, { gender: 'm', plural: 'livros' }).headword).toBe('o livro – os livros');
  });
  it('faltantes por idioma; incontable inglés no exige plural', () => {
    expect(missingGrammar('de', { is_noun: true, gender: 'm' })).toEqual(['article', 'plural']);
    expect(missingGrammar('en', { is_noun: true, countable: false })).toEqual([]);
    expect(missingGrammar('zh', { is_noun: true, pinyin: 'shū' })).toEqual(['classifier']);
    expect(missingGrammar('de', { is_noun: false })).toEqual([]);
  });
});

describe('CompleteGrammarUseCase', () => {
  it('repara en segundo plano solo las incompletas y nunca lanza si la IA falla', async () => {
    const update = jest.fn(async () => undefined);
    const nounGrammar = jest.fn(async () => ({ lemma: 'Tisch', grammar: { is_noun: true, gender: 'm' as const, article: 'der', plural: 'Tische' }, headword: 'der Tisch – die Tische', missing: [], checked: true }));
    const uc = new CompleteGrammarUseCase({ update } as never, { nounGrammar } as unknown as LanguageToolsPort);
    const done = { id: '1', term: 'Buch', language: 'de', reviewed: false, grammar: { is_noun: true, headword: 'das Buch', missing: [], checked: true } };
    const pending = { id: '2', term: 'Tisch', language: 'de', reviewed: false, grammar: null };
    uc.repairPending([done, pending] as unknown as VocabularyEntry[], 't');
    await new Promise((r) => setImmediate(r));
    expect(nounGrammar).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('2', { grammar: expect.objectContaining({ headword: 'der Tisch – die Tische' }) });
    expect(isGrammarComplete(done.grammar as never)).toBe(true);
    nounGrammar.mockRejectedValueOnce(new Error('503'));
    await expect(uc.snapshot('x', 'de', 't')).resolves.toBeNull();
  });
});
