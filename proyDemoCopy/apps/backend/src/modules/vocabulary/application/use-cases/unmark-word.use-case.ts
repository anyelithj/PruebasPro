import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyEntry } from '../../domain/entities/vocabulary-entry.entity';
import { GetMarkedWordUseCase } from './list-marked-words.use-case';
// [UseCase UnmarkWord · Sprint 10.2 · RF-137]: deja de marcar la palabra (deja de resaltarse); la entrada sigue en el banco y en el mazo — para borrarla está DELETE /vocabulary/:id | [Patrón]: Use Case (Command) | [Principio]: SRP + no destruir datos por un clic | [Paradigma]: POO

@Injectable()
export class UnmarkWordUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly get: GetMarkedWordUseCase,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const entry = await this.get.execute(userId, id);
    entry.status = null;
    await this.entries.save(entry);
  }
}
