import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../../users/domain/value-objects/role.vo';
import type { Course } from '../../domain/entities/course.entity';
// [Policy CourseOwnership · 2026-10-27]: ¿puede este usuario GESTIONAR (editar, publicar, borrar, adjuntar material) el curso?
// ADMIN → todos · TEACHER → solo los que creó (`createdBy`) · cursos antiguos sin dueño → solo ADMIN
// [Patrón]: Policy / Specification (función pura reutilizada por los casos de uso) | [Principio]: SRP + DRY (una sola regla para cursos y materiales)
// [Paradigma]: Funcional (sin estado) | `@Roles(Role.TEACHER)` en el controlador hace el RBAC; esta policy añade la regla de PROPIEDAD (ABAC)

// [Actor]: id + rol del JWT (la capa de aplicación no conoce el JWT) | `export interface` (TS): contrato estructural, se borra al compilar
export interface CourseActor {
  id: string;
  role: Role;
}

// [canManageCourse]: predicado puro → útil también para decidir en listados (sin lanzar) | `Pick<…>` (TS): solo los campos que necesita
export const canManageCourse = (
  course: Pick<Course, 'createdBy'>,
  actor: CourseActor,
): boolean =>
  actor.role === Role.ADMIN ||
  (course.createdBy !== null && course.createdBy === actor.id);

// [assertCanManageCourse]: Guard Clause → 403 con mensaje claro | `void` (TS): solo lanza o deja pasar
export function assertCanManageCourse(
  course: Pick<Course, 'createdBy'>,
  actor: CourseActor,
): void {
  if (!canManageCourse(course, actor))
    throw new ForbiddenException(
      'Solo puedes gestionar los cursos que creaste (o pide a un administrador).',
    );
}
