import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyEntry } from '../../domain/entities/vocabulary-entry.entity';
import {
  WORD_MARKED_TO_LEARN_EVENT,
  WordMarkedToLearnEvent,
} from '../../domain/events/word-marked-to-learn.event';
import type { MarkWordDto } from '../dtos/vocabulary-entry.dto';
import { CreateVocabularyEntryUseCase } from './create-vocabulary-entry.use-case';
// [UseCase MarkWordLearning · Sprint 10.2 · RF-137]: «Aprender» en el diccionario — crea (o reutiliza) la entrada del banco con estado «aprendiendo» y avisa con un evento para que Games la agregue al mazo | [Patrón]: Use Case (Command) + Domain Event + Idempotencia | [Principio]: SRP + DRY (reutiliza CreateVocabularyEntry y su caché) + OCP | [Paradigma]: POO + async/await

@Injectable()
export class MarkWordLearningUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly create: CreateVocabularyEntryUseCase,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    userId: string,
    dto: MarkWordDto,
    token: string,
  ): Promise<VocabularyEntry> {
    const entry = await this.create.execute(
      userId,
      {
        language: dto.language,
        term: dto.word,
        translation: dto.translation,
        example: dto.sentence,
      },
      token,
    );
    if (entry.status !== 'learning') {
      entry.status = 'learning';
      await this.entries.save(entry);
    }
    // `emit` (EventEmitter2): síncrono para el productor; el listener de Games es async y sus errores no rompen la respuesta
    this.events.emit(
      WORD_MARKED_TO_LEARN_EVENT,
      new WordMarkedToLearnEvent(userId, entry.id),
    );
    return entry;
  }
}
