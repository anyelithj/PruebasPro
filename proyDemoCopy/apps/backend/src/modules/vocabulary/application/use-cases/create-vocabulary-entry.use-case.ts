import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  termKeyOf,
  VocabularyEntry,
} from '../../domain/entities/vocabulary-entry.entity';
import type { TermLookupResult } from '../../../../shared/domain/interfaces/language-tools.interface';
import type { CreateVocabularyEntryDto } from '../dtos/vocabulary-entry.dto';
import { LookupTermUseCase } from './lookup-term.use-case';
// [UseCase CreateVocabularyEntry · Sprint 8.2 · RF-106/RF-109]: alta de un término en el banco del usuario y completado automático de traducción e IPA UK/US (vía la caché) | [Patrón]: Use Case (Command) + Idempotencia (mismo término = misma entrada) | [Principio]: SRP + DRY (reutiliza LookupTerm y su caché) | [Paradigma]: POO + async/await

@Injectable()
export class CreateVocabularyEntryUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly lookup: LookupTermUseCase,
  ) {}

  async execute(
    userId: string,
    dto: CreateVocabularyEntryDto,
    token: string,
  ): Promise<VocabularyEntry> {
    const termKey = termKeyOf(dto.term);
    const existing = await this.entries.findOneBy({
      userId,
      language: dto.language,
      termKey,
    });
    if (existing) return existing; // [Idempotente]: guardar dos veces no duplica

    const found = (
      await this.lookup.execute(
        { text: dto.term, language: dto.language },
        token,
      )
    ).result as unknown as TermLookupResult;
    return this.entries.save(
      this.entries.create({
        userId,
        language: dto.language,
        term: dto.term,
        termKey,
        // [Prioridad]: lo que escribió el usuario > traducción automática
        translation: dto.translation ?? found.translation.translation,
        alternatives: found.translation.alternatives ?? [],
        ipaUk: found.ipa_uk,
        ipaUs: found.ipa_us,
        ipa: found.ipa,
        example: dto.example ?? null,
        sourceItemId: dto.sourceItemId ?? null,
        reviewed: false, // IPA automático hasta que alguien lo revise
      }),
    );
  }
}
