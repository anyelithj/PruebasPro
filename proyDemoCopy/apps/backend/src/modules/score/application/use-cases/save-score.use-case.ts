import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SCORE_REPOSITORY } from '../../domain/interfaces/score.repository.interface';
import type { IScoreRepository } from '../../domain/interfaces/score.repository.interface';
import {
  SCORE_UPDATED_EVENT,
  ScoreUpdatedEvent,
} from '../../domain/events/score-updated.event';
import { CalculateScoreUseCase } from './calculate-score.use-case';
import { Score } from '../../domain/entities/score.entity';
// [Use Case SaveScore]: orquesta calculate + persist + evento | [Patron]: Command + Facade | [Principio]: SRP + DIP

export interface SaveScoreInput {
  userId: string;
  quizId: string;
  sessionId: string;
  sessionPoints: number;
  correctCount: number;
  totalQuestions: number;
}

@Injectable()
export class SaveScoreUseCase {
  private readonly logger = new Logger(SaveScoreUseCase.name);

  constructor(
    @Inject(SCORE_REPOSITORY) private readonly repo: IScoreRepository,
    private readonly calculator: CalculateScoreUseCase,
    private readonly events: EventEmitter2,
  ) {}

  async execute(input: SaveScoreInput): Promise<Score> {
    const calc = this.calculator.execute({
      sessionPoints: input.sessionPoints,
      correctCount: input.correctCount,
      totalQuestions: input.totalQuestions,
    });
    const saved = await this.repo.create({
      userId: input.userId,
      quizId: input.quizId,
      sessionId: input.sessionId,
      points: calc.points,
      correctCount: input.correctCount,
      totalQuestions: input.totalQuestions,
    });
    this.events.emit(
      SCORE_UPDATED_EVENT,
      new ScoreUpdatedEvent(input.userId, saved.id, calc.points, calc.accuracy),
    );
    this.logger.log(
      `Score saved: user=${input.userId} points=${calc.points} acc=${calc.accuracy.toFixed(2)}`,
    );
    return saved;
  }
}
