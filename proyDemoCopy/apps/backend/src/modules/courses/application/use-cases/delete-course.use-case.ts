import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { CourseMaterialsUseCase } from './course-materials.use-case';
import {
  assertCanManageCourse,
  type CourseActor,
} from '../policies/course-ownership.policy'; // [2026-10-27]: regla de propiedad compartida | [Principio]: DRY
// [UseCase DeleteCourse]: baja dura del curso | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class DeleteCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
    private readonly materials: CourseMaterialsUseCase, // Videos/PDF del curso (sin CASCADE en BD)
  ) {}

  async execute(
    id: string,
    actor?: CourseActor, // [2026-10-27]: el docente solo elimina sus cursos
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Curso ${id} no encontrado`);
    if (actor) assertCanManageCourse(existing, actor);
    await this.materials.removeAll(id); // Sin huérfanos: filas y archivos en disco
    await this.repo.remove(id);
    return { deleted: true, id };
  }
}
