import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
import { assertCanManageCourse, canManageCourse } from '../../../src/modules/courses/application/policies/course-ownership.policy';
import { UpdateCourseUseCase } from '../../../src/modules/courses/application/use-cases/update-course.use-case';
// [Suite propiedad de cursos · 2026-10-27]: ADMIN gestiona todos · TEACHER solo los suyos · cursos sin dueño → solo ADMIN | [Patrón]: Test Double (Stub) | [Paradigma]: AAA

describe('CourseOwnership policy', () => {
  it('ADMIN gestiona cualquier curso, incluso sin dueño', () => {
    expect(canManageCourse({ createdBy: null }, { id: 'a', role: Role.ADMIN })).toBe(true);
    expect(canManageCourse({ createdBy: 't2' }, { id: 'a', role: Role.ADMIN })).toBe(true);
  });

  it('TEACHER gestiona solo los cursos que creó', () => {
    expect(canManageCourse({ createdBy: 't1' }, { id: 't1', role: Role.TEACHER })).toBe(true);
    expect(canManageCourse({ createdBy: 't2' }, { id: 't1', role: Role.TEACHER })).toBe(false);
    expect(canManageCourse({ createdBy: null }, { id: 't1', role: Role.TEACHER })).toBe(false); // Curso antiguo → solo ADMIN
  });

  it('assertCanManageCourse lanza 403 si no es el dueño', () => {
    expect(() => assertCanManageCourse({ createdBy: 't2' }, { id: 't1', role: Role.TEACHER })).toThrow(ForbiddenException);
  });

  it('UpdateCourseUseCase rechaza al docente que no es dueño antes de escribir', async () => {
    const repo = { findById: jest.fn().mockResolvedValue({ id: 'c1', slug: 's', createdBy: 't2' }), update: jest.fn() };
    const useCase = new UpdateCourseUseCase(repo as never, {} as never);
    await expect(useCase.execute('c1', { title: 'X' } as never, { id: 't1', role: Role.TEACHER })).rejects.toThrow(ForbiddenException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
