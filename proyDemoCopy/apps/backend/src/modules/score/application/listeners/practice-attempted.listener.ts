import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PRACTICE_ATTEMPTED_EVENT,
  type PracticeAttemptedEvent,
} from '../../../practice/domain/events/practice-attempted.event';
import { CheckAchievementsUseCase } from '../use-cases/check-achievements.use-case';
// [Listener PracticeAttempted · Sprint 8.12]: cada intento de práctica revisa los logros con su precisión (puntos por evento) | [Patrón]: Observer | [Principio]: OCP (Practice no conoce a Score) + SRP | [Paradigma]: Event-Driven

@Injectable()
export class PracticeAttemptedListener {
  private readonly logger = new Logger(PracticeAttemptedListener.name);

  constructor(private readonly checkAchievements: CheckAchievementsUseCase) {}

  @OnEvent(PRACTICE_ATTEMPTED_EVENT, { async: true })
  async handle(event: PracticeAttemptedEvent): Promise<void> {
    try {
      await this.checkAchievements.execute(
        event.userId,
        Math.round(event.score * 100),
      );
    } catch (err) {
      this.logger.error(
        `Logros tras el intento ${event.attemptId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
