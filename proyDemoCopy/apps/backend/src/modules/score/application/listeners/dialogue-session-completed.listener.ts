import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DIALOGUE_SESSION_COMPLETED_EVENT,
  type DialogueSessionCompletedEvent,
} from '../../../dialogues/domain/events/dialogue-session-completed.event';
import { CheckAchievementsUseCase } from '../use-cases/check-achievements.use-case';
// [Listener DialogueSessionCompleted · Sprint 9.3 · RF-122]: al terminar una conversación con el avatar se revisan los logros con la cobertura del vocabulario del tema | [Patrón]: Observer | [Principio]: OCP (Dialogues no conoce a Score) + SRP | [Paradigma]: Event-Driven

@Injectable()
export class DialogueSessionCompletedListener {
  private readonly logger = new Logger(DialogueSessionCompletedListener.name);

  constructor(private readonly checkAchievements: CheckAchievementsUseCase) {}

  @OnEvent(DIALOGUE_SESSION_COMPLETED_EVENT, { async: true })
  async handle(event: DialogueSessionCompletedEvent): Promise<void> {
    if (!event.userTurns) return; // Conversación abierta y cerrada sin hablar → no cuenta
    try {
      await this.checkAchievements.execute(
        event.userId,
        event.vocabularyCoverage,
      );
    } catch (err) {
      this.logger.error(
        `Logros tras la conversación ${event.sessionId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
