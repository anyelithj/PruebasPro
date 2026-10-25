import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { VocabularyEntry } from '../../../vocabulary/domain/entities/vocabulary-entry.entity';
import { FlashcardState } from '../../domain/entities/flashcard-state.entity';
// [UseCases GetDueFlashcards + GetFlashcard · Sprint 8.5 · RF-99]: tarjetas vencidas hoy (con su palabra, traducción e IPA) y estado de una tarjeta | [Patrón]: Query + composición en memoria (dos consultas, sin N+1) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

export type DueCard = FlashcardState & { entry: VocabularyEntry };

@Injectable()
export class GetDueFlashcardsUseCase {
  constructor(
    @InjectRepository(FlashcardState)
    private readonly cards: Repository<FlashcardState>,
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
  ) {}

  async execute(userId: string, limit = 20): Promise<DueCard[]> {
    const due = await this.cards.find({
      where: { userId, dueAt: LessThanOrEqual(new Date()) },
      order: { dueAt: 'ASC' },
      take: Math.min(limit, 50),
    });
    const byId = new Map(
      (await this.entries.findBy({ id: In(due.map((c) => c.entryId)) })).map(
        (e) => [e.id, e],
      ),
    );
    // `flatMap`: descarta tarjetas cuya palabra se borró del banco
    return due.flatMap((c) =>
      byId.has(c.entryId) ? [{ ...c, entry: byId.get(c.entryId)! }] : [],
    );
  }
}

@Injectable()
export class GetFlashcardUseCase {
  constructor(
    @InjectRepository(FlashcardState)
    private readonly cards: Repository<FlashcardState>,
  ) {}

  async execute(userId: string, id: string): Promise<FlashcardState> {
    const card = await this.cards.findOneBy({ id, userId });
    if (!card) throw new NotFoundException('Tarjeta no encontrada');
    return card;
  }
}
