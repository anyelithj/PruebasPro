import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, IsNull, Repository } from 'typeorm';
import {
  VocabularyEntry,
  type WordStatus,
} from '../../domain/entities/vocabulary-entry.entity';
// [UseCases ListMarkedWords + GetMarkedWord · Sprint 10.2 · RF-137]: palabras que el usuario aprende o ya aprendió (para resaltarlas en cualquier texto) y el detalle de una | [Patrón]: Query (CQRS ligero) | [Principio]: SRP + mínimo privilegio (siempre del usuario del token) | [Paradigma]: POO + async/await

// [MarkedWord]: vista compacta → el texto la compara por termKey sin traer traducciones ni IPA
export type MarkedWord = Pick<
  VocabularyEntry,
  'id' | 'language' | 'term' | 'termKey' | 'status'
>;

@Injectable()
export class ListMarkedWordsUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
  ) {}

  execute(
    userId: string,
    filter: { language?: string; status?: WordStatus },
  ): Promise<MarkedWord[]> {
    return this.entries.find({
      where: {
        userId,
        ...(filter.language ? { language: filter.language } : {}),
        status: filter.status ? In([filter.status]) : Not(IsNull()),
      },
      select: { id: true, language: true, term: true, termKey: true, status: true },
      order: { updatedAt: 'DESC' },
      take: 2000, // Tope del resaltado (un banco muy grande no satura la página)
    });
  }
}

@Injectable()
export class GetMarkedWordUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
  ) {}

  async execute(userId: string, id: string): Promise<VocabularyEntry> {
    const entry = await this.entries.findOneBy({
      id,
      userId,
      status: Not(IsNull()),
    });
    if (!entry) throw new NotFoundException('Palabra no marcada');
    return entry;
  }
}
