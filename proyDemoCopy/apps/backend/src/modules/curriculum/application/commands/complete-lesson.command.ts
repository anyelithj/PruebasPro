import { Inject, Injectable } from '@nestjs/common';
import {
  COURSE_OUTLINE_REPOSITORY,
  type ICourseOutlineRepository,
} from '../../domain/interfaces/course-outline.repository.interface';
import type { CurriculumActor } from '../curriculum-actor';
import { GetCourseOutlineQuery } from '../queries/get-course-outline.query';
// [Command CompleteLesson]: el estudiante marca la lección como completada y recibe la siguiente de la línea de tiempo | [Patrón]: Command Handler (CQRS) | [Principio]: SRP + idempotencia (repetirlo no duplica)

@Injectable()
export class CompleteLessonCommand {
  constructor(
    @Inject(COURSE_OUTLINE_REPOSITORY) private readonly outlines: ICourseOutlineRepository,
    private readonly outline: GetCourseOutlineQuery, // [DRY]: valida curso y lección con la misma consulta que la vista
  ) {}

  async execute(courseId: string, lessonId: string, actor: CurriculumActor): Promise<{ lessonId: string; nextLessonId: string | null }> {
    await this.outline.lesson(courseId, lessonId, actor); // 404 si la lección no es de este curso
    await this.outlines.completeLesson(actor.id, lessonId);
    const { summary } = await this.outline.execute(courseId, actor); // Siguiente pendiente (puede no ser la inmediata si se saltó alguna)
    return { lessonId, nextLessonId: summary.nextLessonId };
  }
}
