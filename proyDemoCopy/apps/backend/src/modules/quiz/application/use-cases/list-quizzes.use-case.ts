import { Inject, Injectable } from '@nestjs/common';
import { QUIZ_REPOSITORY } from '../../domain/interfaces/quiz.repository.interface';
import type {
  IQuizRepository,
  ListQuizzesOptions,
  PaginatedQuizzes,
} from '../../domain/interfaces/quiz.repository.interface';
// [Use Case ListQuizzes]: paginación + filtros | [Patrón]: Query + Use Case | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class ListQuizzesUseCase {
  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
  ) {}

  // [execute]: aplica defaults; respeta publishedOnly explícito (false → lista incluye no-publicados, p. ej. panel docente) | [Principio]: ISP
  async execute(options: ListQuizzesOptions): Promise<PaginatedQuizzes> {
    return this.repo.listQuizzes({
      page: options.page ?? 1,
      limit: Math.min(options.limit ?? 12, 50),
      category: options.category,
      difficulty: options.difficulty,
      authorId: options.authorId,
      publishedOnly:
        options.publishedOnly === undefined ? true : options.publishedOnly,
    });
  }
}
