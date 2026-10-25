import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyEntry } from '../../../vocabulary/domain/entities/vocabulary-entry.entity';
import { FlashcardState } from '../../domain/entities/flashcard-state.entity';
import { SM2_START } from '../../domain/sm2';
// [UseCase AddFlashcard · Sprint 8.5 · RF-99]: agrega una palabra del banco al mazo (vence hoy) | [Patrón]: Use Case (Command) + Idempotencia | [Principio]: SRP + mínimo privilegio (solo palabras propias) | [Paradigma]: POO

@Injectable()
export class AddFlashcardUseCase {
  constructor(
    @InjectRepository(FlashcardState)
    private readonly cards: Repository<FlashcardState>,
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
  ) {}

  async execute(userId: string, entryId: string): Promise<FlashcardState> {
    if (!(await this.entries.existsBy({ id: entryId, userId })))
      throw new NotFoundException(
        'La palabra no está en tu banco de vocabulario',
      );
    const existing = await this.cards.findOneBy({ userId, entryId });
    if (existing) return existing; // [Idempotente]: ya está en el mazo
    return this.cards.save(
      this.cards.create({
        userId,
        entryId,
        ...SM2_START,
        dueAt: new Date(),
        lastQuality: null,
      }),
    );
  }
}
