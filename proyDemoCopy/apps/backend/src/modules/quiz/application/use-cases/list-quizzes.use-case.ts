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
      language: options.language, // [2026-10-27]: idioma opcional (undefined = todos)
      search: options.search?.trim().slice(0, 120) || undefined, // [2026-10-30]: vacío = sin filtro; tope de longitud en la frontera
      status: options.status,
      publishedOnly:
        options.publishedOnly === undefined ? true : options.publishedOnly,
    });
  }
}
