import {
  ACTIVE_COURSE_GROUPS,
  CourseCategory,
  CourseGroup,
  courseCategoryLabel,
  resolveCourseGroup,
} from '../../../src/modules/courses/domain/value-objects/course-category.vo';
import { buildLanguageCourseSeed } from '../../../src/modules/courses/infrastructure/seeds/language-courses.seed';
import { CEFR_LEVELS, compareCefr, CefrLevel } from '../../../src/shared/domain/cefr-level.vo';

// [Suite catálogo de idiomas]: reglas de dominio de cursos (idioma × nivel MCER) + seed determinista

describe('CourseCategory / CourseGroup (catálogo de idiomas)', () => {
  it('ofrece exactamente los 7 idiomas de la plataforma', () => {
    expect([...ACTIVE_COURSE_GROUPS].sort()).toEqual(['DE', 'EN', 'ES', 'FR', 'PT', 'RU', 'ZH']);
  });

  it('un nivel MCER exige idioma explícito', () => {
    expect(() => resolveCourseGroup(CourseCategory.B1)).toThrow(/requiere un idioma/);
    expect(resolveCourseGroup(CourseCategory.B1, CourseGroup.FR)).toBe(CourseGroup.FR);
  });

  it('una categoría legacy deriva su grupo legacy (compatibilidad con filas antiguas)', () => {
    expect(resolveCourseGroup(CourseCategory.STEM_ARTS)).toBe(CourseGroup.STEM);
  });

  it('compone etiqueta legible idioma · nivel', () => {
    expect(courseCategoryLabel(CourseCategory.A2, CourseGroup.DE)).toBe('Alemán · A2 · Plataforma');
    expect(courseCategoryLabel(CourseCategory.MASTER_CLASS, CourseGroup.MASTER_CLASS)).toBe('MASTER_CLASS');
  });
});

describe('buildLanguageCourseSeed', () => {
  const seed = buildLanguageCourseSeed();

  it('genera 7 idiomas × 6 niveles = 42 cursos con slug único', () => {
    expect(seed).toHaveLength(42);
    expect(new Set(seed.map((c) => c.slug)).size).toBe(42);
  });

  it('no inventa métricas (rating, alumnos, horas en 0)', () => {
    for (const c of seed) {
      expect(c.rating).toBe(0);
      expect(c.studentsCount).toBe(0);
      expect(c.durationHours).toBe(0);
    }
  });

  it('no usa colores verdes', () => {
    const greens = ['#10B981', '#22C55E', '#A4CE3A', '#1A8A9A'];
    for (const c of seed) expect(greens).not.toContain(c.color!.toUpperCase());
  });
});

describe('CefrLevel', () => {
  it('ordena A1 < C2', () => {
    expect(CEFR_LEVELS).toHaveLength(6);
    expect(compareCefr(CefrLevel.A1, CefrLevel.C2)).toBeLessThan(0);
  });
});
