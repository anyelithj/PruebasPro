import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { CourseResponseDto } from '../dtos/course-response.dto';
import {
  assertCanManageCourse,
  type CourseActor,
} from '../policies/course-ownership.policy'; // [2026-10-27]: regla de propiedad compartida | [Principio]: DRY
import { assertHasFinalExam } from '../policies/course-exam.policy';
// [UseCase SetPublished]: activa/desactiva publicación del curso (baja blanda) | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class SetPublishedUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
    private readonly db: DataSource,
  ) {}

  async execute(
    id: string,
    isPublished: boolean,
    actor?: CourseActor, // [2026-10-27]: el docente solo publica/despublica sus cursos
  ): Promise<CourseResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Curso ${id} no encontrado`);
    if (actor) assertCanManageCourse(existing, actor);
    if (isPublished && !existing.isPublished)
      await assertHasFinalExam(this.db, id); // [2026-11-10]: sin examen no hay certificado
    const updated = await this.repo.setPublished(id, isPublished);
    return CourseResponseDto.fromDomain(updated, null);
  }
}
