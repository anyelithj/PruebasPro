import { Role } from "@/lib/constants";
import type { CourseResponse } from "@/types/courses";
// [course-access · 2026-10-27]: ¿el usuario puede GESTIONAR (editar, publicar, borrar, adjuntar material) este curso?
// ADMIN → todos · DOCENTE → solo los que creó (`createdBy`) · cursos antiguos sin dueño → solo ADMIN
// Espejo de la policy NestJS (courses/application/policies/course-ownership.policy) → la UI solo REFLEJA; el backend decide (403) | [Principio]: SSOT de la regla + DRY | [Paradigma]: Funcional (puro)

// `Pick<…>` (TS): solo los campos necesarios → sirve con el listado y con el detalle
export const canManageCourse = (course: Pick<CourseResponse, "createdBy">, user: { sub: string; role: Role } | null): boolean =>
  !!user && (user.role === Role.ADMIN || (user.role === Role.TEACHER && !!course.createdBy && course.createdBy === user.sub));
