import { validateCurriculumContent } from '../../../src/modules/curriculum/domain/content/curriculum-content.schema';
import { vocabularyArticleProblem } from '../../../src/modules/curriculum/domain/content/vocabulary-article';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { Language } from '../../../src/shared/domain/language.vo';

// [2026-11-02]: artículo obligatorio en sustantivos de/fr/pt/es · opcional en inglés · «No aplica» en ruso y chino
const noun = (lemma: string, article?: string) => ({ lemma, article, partOfSpeech: 'sustantivo', translationEs: 'x' });

describe('vocabularyArticleProblem', () => {
  it('exige el artículo en sustantivos de alemán, francés, portugués y español', () => {
    expect(vocabularyArticleProblem(Language.DE, noun('Obst'))).toMatch(/obligatorio/);
    expect(vocabularyArticleProblem(Language.FR, noun('eau'))).toMatch(/obligatorio/);
    expect(vocabularyArticleProblem(Language.PT, noun('casa'))).toMatch(/obligatorio/);
    expect(vocabularyArticleProblem(Language.ES, noun('mesa'))).toMatch(/obligatorio/);
  });

  it('acepta los artículos de cada idioma (también l’ tipográfico y mayúsculas)', () => {
    expect(vocabularyArticleProblem(Language.DE, noun('Obst', 'das'))).toBeNull();
    expect(vocabularyArticleProblem(Language.FR, noun('eau', 'l’'))).toBeNull();
    expect(vocabularyArticleProblem(Language.FR, noun('enfants', 'les'))).toBeNull();
    expect(vocabularyArticleProblem(Language.PT, noun('casas', 'As'))).toBeNull();
    expect(vocabularyArticleProblem(Language.ES, noun('mesas', 'las'))).toBeNull();
  });

  it('rechaza artículos de otro idioma', () => {
    expect(vocabularyArticleProblem(Language.DE, noun('Obst', 'le'))).toMatch(/no válido/);
    expect(vocabularyArticleProblem(Language.ES, noun('mesa', 'the'))).toMatch(/no válido/);
  });

  it('respeta el artículo ya escrito en la palabra (datos existentes) y no exige nada si no consta que sea sustantivo', () => {
    expect(vocabularyArticleProblem(Language.DE, noun('das Obst'))).toBeNull();
    expect(vocabularyArticleProblem(Language.FR, noun("l'eau"))).toBeNull();
    expect(vocabularyArticleProblem(Language.DE, { lemma: 'laufen', partOfSpeech: 'verbo' })).toBeNull();
    expect(vocabularyArticleProblem(Language.DE, { lemma: 'Obst' })).toBeNull();
  });

  it('inglés: opcional y solo a, an o the', () => {
    expect(vocabularyArticleProblem(Language.EN, noun('apple'))).toBeNull();
    expect(vocabularyArticleProblem(Language.EN, noun('apple', 'an'))).toBeNull();
    expect(vocabularyArticleProblem(Language.EN, noun('apple', 'der'))).toMatch(/no válido/);
  });

  it('ruso y chino: no aplica', () => {
    expect(vocabularyArticleProblem(Language.RU, noun('вода'))).toBeNull();
    expect(vocabularyArticleProblem(Language.ZH, noun('水', 'the'))).toMatch(/no aplica/);
  });

  it('el esquema conserva el campo article (antes Zod lo descartaba)', () => {
    const r = validateCurriculumContent(CurriculumItemKind.VOCABULARY, noun('Obst', 'das'));
    expect(r.ok && r.content.article).toBe('das');
  });
});
