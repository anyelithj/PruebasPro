import {
  ACTIVE_CATEGORIES,
  Category,
  CATEGORY_LABEL_ES,
  isCategory,
} from '../../../src/modules/quiz/domain/value-objects/category.vo';

// [Suite Category]: catálogo de competencias lingüísticas + valores legacy para compatibilidad con BD

describe('Category (Value Object competencias lingüísticas)', () => {
  it('incluye las competencias MCER', () => {
    for (const c of [
      'grammar',
      'vocabulary',
      'reading',
      'listening',
      'writing',
      'speaking',
      'pronunciation',
    ]) {
      expect(isCategory(c)).toBe(true);
    }
  });

  it('solo ofrece competencias vigentes (sin materias escolares legacy)', () => {
    expect(ACTIVE_CATEGORIES).toContain(Category.GRAMMAR);
    expect(ACTIVE_CATEGORIES).toContain(Category.GENERAL);
    expect(ACTIVE_CATEGORIES).toContain(Category.CUSTOM);
    expect(ACTIVE_CATEGORIES).not.toContain(Category.MATH);
    expect(ACTIVE_CATEGORIES).not.toContain(Category.ENGLISH);
  });

  it('toda competencia vigente tiene etiqueta en español', () => {
    for (const c of ACTIVE_CATEGORIES) {
      expect(CATEGORY_LABEL_ES[c]).toBeTruthy();
    }
  });

  it('acepta valores legacy para no invalidar filas existentes', () => {
    expect(isCategory(Category.MATH)).toBe(true);
    expect(isCategory('history')).toBe(true);
  });

  it('rechaza valores arbitrarios', () => {
    expect(isCategory('sports')).toBe(false);
    expect(isCategory('foo')).toBe(false);
    expect(isCategory('')).toBe(false);
  });
});
