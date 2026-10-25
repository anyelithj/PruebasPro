import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyEntry } from '../../domain/entities/vocabulary-entry.entity';
import type { UpdateVocabularyEntryDto } from '../dtos/vocabulary-entry.dto';
import { GetVocabularyEntryUseCase } from './list-my-vocabulary.use-case';
// [UseCase UpdateVocabularyEntry · Sprint 8.2]: corrige traducción, IPA o ejemplo; la corrección manual prevalece y marca la entrada como revisada | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (GetVocabularyEntry valida el dueño) | [Paradigma]: POO

@Injectable()
export class UpdateVocabularyEntryUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly get: GetVocabularyEntryUseCase,
  ) {}

  async execute(
    userId: string,
    id: string,
    dto: UpdateVocabularyEntryDto,
  ): Promise<VocabularyEntry> {
    const entry = await this.get.execute(userId, id);
    // `Object.assign` (JS): solo copia los campos que llegaron (PATCH parcial) | `?? null`: cadena vacía no borra
    Object.assign(
      entry,
      Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined),
      ),
      { reviewed: true },
    );
    return this.entries.save(entry);
  }
}
