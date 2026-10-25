import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VocabularyEntry,
  type WordStatus,
} from '../../domain/entities/vocabulary-entry.entity';
import { GetMarkedWordUseCase } from './list-marked-words.use-case';
// [UseCase MarkWordLearned · Sprint 10.2 · RF-137]: «Aprendido» (o volver a «aprendiendo») sobre una palabra marcada; la tarjeta del mazo no se toca (el SM-2 sigue su curso) | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class MarkWordLearnedUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly get: GetMarkedWordUseCase,
  ) {}

  async execute(
    userId: string,
    id: string,
    status: WordStatus,
  ): Promise<VocabularyEntry> {
    const entry = await this.get.execute(userId, id);
    entry.status = status;
    return this.entries.save(entry);
  }
}
