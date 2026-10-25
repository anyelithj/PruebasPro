import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashcardState } from '../../domain/entities/flashcard-state.entity';
import { sm2 } from '../../domain/sm2';
import { GetFlashcardUseCase } from './get-due-flashcards.use-case';
// [UseCase ReviewFlashcard · Sprint 8.5 · RF-99]: el usuario intentó recordar antes de ver la respuesta y califica su recuerdo (0 a 5) → SM-2 reprograma | [Patrón]: Use Case (Command) + función pura (sm2) | [Principio]: SRP + determinístico | [Paradigma]: POO + Funcional

@Injectable()
export class ReviewFlashcardUseCase {
  constructor(
    @InjectRepository(FlashcardState)
    private readonly cards: Repository<FlashcardState>,
    private readonly get: GetFlashcardUseCase,
  ) {}

  async execute(
    userId: string,
    id: string,
    quality: number,
  ): Promise<FlashcardState> {
    const card = await this.get.execute(userId, id);
    const next = sm2(card, quality, new Date());
    Object.assign(card, next, { lastQuality: quality });
    return this.cards.save(card);
  }
}
