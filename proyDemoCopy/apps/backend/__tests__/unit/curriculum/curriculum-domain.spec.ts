import { validateCurriculumContent } from '../../../src/modules/curriculum/domain/content/curriculum-content.schema';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { ReviewStatus, canTransition, initialStatus, isReturn } from '../../../src/modules/curriculum/domain/value-objects/review-status.vo';
import { LanguageSkill } from '../../../src/shared/domain/language-skill.vo';
import { ACTIVE_CATEGORIES } from '../../../src/modules/quiz/domain/value-objects/category.vo';

// [Suite dominio curricular]: esquemas de contenido, máquina de estados y alineación entre módulos

describe('validateCurriculumContent', () => {
  it('acepta una regla gramatical válida y normaliza defaults', () => {
    const r = validateCurriculumContent(CurriculumItemKind.GRAMMAR_RULE, {
      title: '  Present perfect ',
      explanationEs: 'Acciones pasadas con relevancia presente.',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content.title).toBe('Present perfect'); // trim
      expect(r.content.examples).toEqual([]); // default
    }
  });

  it('exige variante dialectal en la IPA (no pronunciación universal)', () => {
    const r = validateCurriculumContent(CurriculumItemKind.PRONUNCIATION, {
      text: 'water',
      ipa: { value: '/ˈwɔːtə/' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/ipa\.variant/);
  });

  it('ejercicio multiple_choice: la clave debe estar entre las opciones', () => {
    const bad = validateCurriculumContent(CurriculumItemKind.EXERCISE, {
      prompt: 'She ___ to school.',
      type: 'multiple_choice',
      options: ['go', 'goes'],
      answerKey: ['went'],
    });
    expect(bad.ok).toBe(false);

    const good = validateCurriculumContent(CurriculumItemKind.EXERCISE, {
      prompt: 'She ___ to school.',
      type: 'multiple_choice',
      options: ['go', 'goes'],
      answerKey: ['goes'],
    });
    expect(good.ok).toBe(true);
  });

  it('rúbrica (Sprint 5.5): criterios con peso y bandas que no superan el peso', () => {
    const rubric = (points: number) =>
      validateCurriculumContent(CurriculumItemKind.RUBRIC, {
        title: 'Correo informal B1',
        criteria: [{ name: 'Coherencia', descriptorEs: 'Ideas enlazadas', maxPoints: 4, bands: [{ points, descriptorEs: 'Excelente' }] }],
      });
    expect(rubric(4).ok).toBe(true);
    const bad = rubric(5);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join(' ')).toMatch(/maxPoints/);
  });

  it('rechaza contenido que no es objeto', () => {
    expect(validateCurriculumContent(CurriculumItemKind.EXAMPLE, 'texto suelto').ok).toBe(false);
  });
});

describe('ReviewStatus (máquina de estados)', () => {
  it('no permite aprobar directamente un borrador', () => {
    expect(canTransition(ReviewStatus.DRAFT, ReviewStatus.APPROVED)).toBe(false);
  });

  it('flujo feliz draft → review_required → reviewed → approved → archived', () => {
    expect(canTransition(ReviewStatus.DRAFT, ReviewStatus.REVIEW_REQUIRED)).toBe(true);
    expect(canTransition(ReviewStatus.REVIEW_REQUIRED, ReviewStatus.REVIEWED)).toBe(true);
    expect(canTransition(ReviewStatus.REVIEWED, ReviewStatus.APPROVED)).toBe(true);
    expect(canTransition(ReviewStatus.APPROVED, ReviewStatus.ARCHIVED)).toBe(true);
  });

  it('lo generado por IA no se aprueba sin pasar por revisión', () => {
    expect(initialStatus(true)).toBe(ReviewStatus.GENERATED);
    expect(initialStatus(false)).toBe(ReviewStatus.DRAFT);
    expect(canTransition(ReviewStatus.GENERATED, ReviewStatus.APPROVED)).toBe(false);
    expect(canTransition(ReviewStatus.REVIEW_REQUIRED, ReviewStatus.APPROVED)).toBe(false); // falta «revisado»
  });

  it('volver a borrador desde revisión es una devolución; desde publicado no', () => {
    expect(isReturn(ReviewStatus.REVIEW_REQUIRED, ReviewStatus.DRAFT)).toBe(true);
    expect(isReturn(ReviewStatus.REVIEWED, ReviewStatus.DRAFT)).toBe(true);
    expect(isReturn(ReviewStatus.APPROVED, ReviewStatus.DRAFT)).toBe(false);
  });
});

describe('Alineación LanguageSkill ↔ Category (quiz)', () => {
  it('cada competencia curricular existe como categoría vigente de quiz', () => {
    for (const s of Object.values(LanguageSkill)) {
      expect(ACTIVE_CATEGORIES as readonly string[]).toContain(s);
    }
  });
});
