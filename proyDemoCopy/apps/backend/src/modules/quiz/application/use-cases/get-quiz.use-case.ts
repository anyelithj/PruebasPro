import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { QUIZ_REPOSITORY } from '../../domain/interfaces/quiz.repository.interface';
import type { IQuizRepository } from '../../domain/interfaces/quiz.repository.interface';
import { Quiz } from '../../domain/entities/quiz.entity';
// [Use Case GetQuiz]: lookup por ID con/sin preguntas | [Patrón]: Query + Use Case | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class GetQuizUseCase {
  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
  ) {}

  // [execute]: lanza si no existe; default carga preguntas para vista de detalle
  async execute(id: string, withQuestions = true): Promise<Quiz> {
    const quiz = await this.repo.findQuizById(id, withQuestions);
    if (!quiz) throw new NotFoundException(`Quiz ${id} not found`);
    return quiz;
  }
}
