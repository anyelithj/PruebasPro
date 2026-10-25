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

// [Toggle payload]: estado boolean atómico para favoritos/reacciones
export type ReactionKind = 'like' | 'love' | 'favorite';

export interface ICourseRepository {
  findAll(criteria: CourseSearchCriteria): Promise<PaginatedCourses>;
  findById(id: string): Promise<Course | null>;
  findBySlug(slug: string): Promise<Course | null>;
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
