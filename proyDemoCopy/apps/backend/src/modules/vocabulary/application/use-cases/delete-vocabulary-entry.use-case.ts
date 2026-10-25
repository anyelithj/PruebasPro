import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyEntry } from '../../domain/entities/vocabulary-entry.entity';
import { GetVocabularyEntryUseCase } from './list-my-vocabulary.use-case';
// [UseCase DeleteVocabularyEntry · Sprint 8.2]: elimina una entrada propia | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio (404 si no es del usuario) | [Paradigma]: POO

@Injectable()
export class DeleteVocabularyEntryUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly get: GetVocabularyEntryUseCase,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    await this.entries.remove(await this.get.execute(userId, id));
  }
}
