import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashcardState } from '../../domain/entities/flashcard-state.entity';
import { GetFlashcardUseCase } from './get-due-flashcards.use-case';
// [UseCase RemoveFlashcard · Sprint 8.5]: quita una tarjeta del mazo (la palabra sigue en el banco) | [Patrón]: Use Case (Command) | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class RemoveFlashcardUseCase {
  constructor(
    @InjectRepository(FlashcardState)
    private readonly cards: Repository<FlashcardState>,
    private readonly get: GetFlashcardUseCase,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    await this.cards.remove(await this.get.execute(userId, id));
  }
}
