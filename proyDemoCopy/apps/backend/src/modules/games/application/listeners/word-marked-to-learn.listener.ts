import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WORD_MARKED_TO_LEARN_EVENT,
  type WordMarkedToLearnEvent,
} from '../../../vocabulary/domain/events/word-marked-to-learn.event';
import { AddFlashcardUseCase } from '../use-cases/add-flashcard.use-case';
// [Listener WordMarkedToLearn · Sprint 10.2 · RF-137]: «Aprender» en el diccionario → la palabra entra al mazo de flashcards (vence hoy); idempotente si ya estaba | [Patrón]: Observer | [Principio]: OCP (Vocabulary no conoce a Games) + DRY (reutiliza AddFlashcard) | [Paradigma]: Event-Driven

@Injectable()
export class WordMarkedToLearnListener {
  private readonly logger = new Logger(WordMarkedToLearnListener.name);

  constructor(private readonly addFlashcard: AddFlashcardUseCase) {}

  @OnEvent(WORD_MARKED_TO_LEARN_EVENT, { async: true })
  async handle(event: WordMarkedToLearnEvent): Promise<void> {
    try {
      await this.addFlashcard.execute(event.userId, event.entryId);
    } catch (err) {
      this.logger.error(
        `Mazo de la palabra ${event.entryId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
