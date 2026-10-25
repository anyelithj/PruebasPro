import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
  type ReactionKind,
} from '../../domain/interfaces/course.repository.interface';
// [UseCase ToggleReaction]: alterna like/love en un curso | [Patrón]: Use Case (Command) + Strategy | [Principio]: SRP + OCP

@Injectable()
export class ToggleReactionUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  async execute(
    userId: string,
    courseId: string,
    kind: ReactionKind,
  ): Promise<{
    courseId: string;
    like: boolean;
    love: boolean;
    favorite: boolean;
  }> {
    const course = await this.repo.findById(courseId);
    if (!course) throw new NotFoundException(`Curso ${courseId} no encontrado`);
    const current = await this.repo.getEnrollment(userId, courseId);

    // [Strategy declarativa]: cada kind muta su flag correspondiente | [Patrón]: Strategy via lookup
    const patch =
      kind === 'like'
        ? { reactionLike: !(current?.reactionLike ?? false) }
        : kind === 'love'
          ? { reactionLove: !(current?.reactionLove ?? false) }
          : { isFavorite: !(current?.isFavorite ?? false) };

    const updated = await this.repo.upsertEnrollment(userId, courseId, patch);
    return {
      courseId,
      like: updated.reactionLike,
      love: updated.reactionLove,
      favorite: updated.isFavorite,
    };
  }
}
