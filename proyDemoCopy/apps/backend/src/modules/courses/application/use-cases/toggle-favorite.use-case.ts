import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
// [UseCase ToggleFavorite]: marcar/desmarcar favorito de un curso | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class ToggleFavoriteUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  async execute(
    userId: string,
    courseId: string,
  ): Promise<{ courseId: string; isFavorite: boolean }> {
    const course = await this.repo.findById(courseId);
    if (!course) throw new NotFoundException(`Curso ${courseId} no encontrado`);
    const current = await this.repo.getEnrollment(userId, courseId);
    const next = !(current?.isFavorite ?? false);
    const updated = await this.repo.upsertEnrollment(userId, courseId, {
      isFavorite: next,
    });
    return { courseId, isFavorite: updated.isFavorite };
  }
}
