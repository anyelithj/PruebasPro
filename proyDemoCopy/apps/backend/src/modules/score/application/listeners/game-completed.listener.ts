import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  GAME_COMPLETED_EVENT,
  type GameCompletedEvent,
} from '../../../games/domain/events/game-completed.event';
import { CheckAchievementsUseCase } from '../use-cases/check-achievements.use-case';
// [Listener GameCompleted · Sprint 8.5]: al terminar una partida se revisan los logros con su precisión (el puntaje de la partida vive en GameSession) | [Patrón]: Observer | [Principio]: OCP (Games no conoce a Score) + SRP | [Paradigma]: Event-Driven

@Injectable()
export class GameCompletedListener {
  private readonly logger = new Logger(GameCompletedListener.name);

  constructor(private readonly checkAchievements: CheckAchievementsUseCase) {}

  @OnEvent(GAME_COMPLETED_EVENT, { async: true })
  async handle(event: GameCompletedEvent): Promise<void> {
    try {
      await this.checkAchievements.execute(event.userId, event.accuracy);
    } catch (err) {
      this.logger.error(
        `Logros tras la partida ${event.sessionId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
