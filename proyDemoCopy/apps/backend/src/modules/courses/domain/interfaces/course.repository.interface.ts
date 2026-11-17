import { Course } from '../entities/course.entity';
import { CourseEnrollment } from '../entities/course-enrollment.entity';
import {
  CourseCategory,
  CourseGroup,
} from '../value-objects/course-category.vo';
// [Port ICourseRepository]: contrato del dominio para persistencia | [Patrón]: Repository + Dependency Inversion | [Principio]: DIP + ISP

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');

// [Criterios de búsqueda]: SSOT para listado/filtro del catálogo
export interface CourseSearchCriteria {
  group?: CourseGroup;
  category?: CourseCategory;
  eje?: number;
  search?: string;
  isProBono?: boolean;
  isPublished?: boolean;
  createdBy?: string; // [2026-10-27]: «Mis cursos» del docente (gestión) | `?` (TS): ausente = todos
  // [onlyActiveGroups]: restringe a los idiomas vigentes (excluye catálogo legacy)
  onlyActiveGroups?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedCourses {
  data: Course[];
  total: number;
  page: number;
  limit: number;
}

export interface ICourseRepository {
  findAll(criteria: CourseSearchCriteria): Promise<PaginatedCourses>;
  findById(id: string): Promise<Course | null>;
  findBySlug(slug: string): Promise<Course | null>;
  // [findTitlesInScope · 2026-10-28]: id + título de los cursos del mismo idioma (grupo) y nivel (categoría) → regla anti-duplicados por título normalizado | lectura ligera
  findTitlesInScope(
    group: string,
    category: string,
  ): Promise<Array<Pick<Course, 'id' | 'title'>>>;
  // [Mutaciones administrativas]: alta/edición/baja/publicación | [Principio]: DIP
  create(course: Partial<Course>): Promise<Course>;
  update(id: string, patch: Partial<Course>): Promise<Course>;
  remove(id: string): Promise<void>;
  setPublished(id: string, isPublished: boolean): Promise<Course>;
  // [Inscripciones]
  getEnrollment(
    userId: string,
    courseId: string,
  ): Promise<CourseEnrollment | null>;
  upsertEnrollment(
    userId: string,
    courseId: string,
    patch: Partial<CourseEnrollment>,
  ): Promise<CourseEnrollment>;
  listEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]>;
}
