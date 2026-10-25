import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  QUIZ_COMPLETED_EVENT,
  QuizCompletedEvent,
} from '../../../quiz/domain/events/quiz-completed.event';
import { SaveScoreUseCase } from '../use-cases/save-score.use-case';
import { CheckAchievementsUseCase } from '../use-cases/check-achievements.use-case';
// [Listener QuizCompleted]: orquesta SaveScore + CheckAchievements | [Patron]: Observer + Saga | [Principio]: SRP + OCP | [Paradigma]: Event-Driven

@Injectable()
export class QuizCompletedListener {
  private readonly logger = new Logger(QuizCompletedListener.name);

  constructor(
    private readonly saveScore: SaveScoreUseCase,
    private readonly checkAchievements: CheckAchievementsUseCase,
  ) {}

  // [OnEvent]: async para no bloquear el productor | [Patron]: Async Subscriber
  @OnEvent(QUIZ_COMPLETED_EVENT, { async: true })
  async handle(event: QuizCompletedEvent): Promise<void> {
    try {
      const score = await this.saveScore.execute({
        userId: event.userId,
        quizId: event.quizId,
        sessionId: event.sessionId,
        sessionPoints: event.totalScore,
        correctCount: event.correctCount,
        totalQuestions: event.totalQuestions,
      });
      await this.checkAchievements.execute(event.userId, score.accuracy);
    } catch (err) {
      // [Catch local]: errores no se propagan al emisor (fire-and-forget)
      this.logger.error(
        `Failed to process QuizCompleted ${event.sessionId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
