import type { Language } from '../../../../shared/domain/language.vo';
import type { PlannedNode, StoredNode } from '../course-outline';
import type { CurriculumItem } from '../entities/curriculum-item.entity';
// [Port ICourseOutlineRepository]: persistencia de la estructura del curso; la infraestructura (TypeORM) lo implementa | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP (puerto propio, separado del de recursos)

// `Symbol` (ES2015): token único de inyección
export const COURSE_OUTLINE_REPOSITORY = Symbol('COURSE_OUTLINE_REPOSITORY');

// [Referencia mínima al curso]: el idioma sale del grupo del catálogo (EN → en); null si el curso no es de idioma
export interface CourseRef {
  id: string;
  language: Language | null;
}

// [LessonRef · Sprint 7.14]: lección con su curso (los foros solo conocen el id de la lección)
export interface LessonRef {
  id: string;
  courseId: string;
  title: string;
}

export interface ICourseOutlineRepository {
  findCourse(courseId: string): Promise<CourseRef | null>;
  // [Estructura primero]: actualiza los nodos con id, crea los nuevos y borra los que ya no están (transacción); enlaza recursos sin duplicar
  saveOutline(
    courseId: string,
    nodes: ReadonlyArray<PlannedNode>,
    links: ReadonlyMap<string, ReadonlyArray<string>>,
  ): Promise<void>;
  findOutline(courseId: string): Promise<StoredNode[]>; // Árbol plano con los recursos de cada lección
  findLesson(courseId: string, lessonId: string): Promise<StoredNode | null>;
  findLessonRef(lessonId: string): Promise<LessonRef | null>; // [Sprint 7.14]: Forums valida la lección y deduce el curso
  findLessonItems(lessonId: string): Promise<CurriculumItem[]>; // Recursos completos (contenido) para mostrar la lección
  addLessonItems(
    lessonId: string,
    itemIds: ReadonlyArray<string>,
  ): Promise<void>; // Enlaza sin duplicar
  // [Progreso del estudiante]: idempotente (completar dos veces no duplica)
  completedLessonIds(userId: string, courseId: string): Promise<string[]>;
  completeLesson(userId: string, lessonId: string): Promise<void>;
}
