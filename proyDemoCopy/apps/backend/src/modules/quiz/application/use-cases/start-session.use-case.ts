import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUIZ_REPOSITORY } from '../../domain/interfaces/quiz.repository.interface';
import type { IQuizRepository } from '../../domain/interfaces/quiz.repository.interface';
import {
  QUIZ_STARTED_EVENT,
  QuizStartedEvent,
} from '../../domain/events/quiz-started.event';
import { QuizSession } from '../../domain/entities/quiz-session.entity';
// [Use Case StartSession]: crea sesion + emite QuizStarted | [Patron]: Command | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class StartSessionUseCase {
  private readonly logger = new Logger(StartSessionUseCase.name);

  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(userId: string, quizId: string): Promise<QuizSession> {
    const quiz = await this.repo.findQuizById(quizId, false);
    if (!quiz) throw new NotFoundException(`Quiz ${quizId} not found`);

    const session = await this.repo.createSession(userId, quizId);
    this.events.emit(
      QUIZ_STARTED_EVENT,
      new QuizStartedEvent(session.id, userId, quizId),
    );
    this.logger.log(`Session started: ${session.id} (user=${userId})`);
    return session;
  }
}
