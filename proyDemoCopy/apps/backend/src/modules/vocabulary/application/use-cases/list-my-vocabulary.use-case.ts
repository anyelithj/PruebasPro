import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, type FindOptionsWhere } from 'typeorm';
import { VocabularyEntry } from '../../domain/entities/vocabulary-entry.entity';
import { CompleteGrammarUseCase } from './complete-grammar.use-case';
// [UseCases ListMyVocabulary + GetVocabularyEntry · Sprint 8.2 · RF-109]: banco propio con filtros por idioma y texto, y detalle de una entrada (solo el dueño) | [Patrón]: Query (CQRS ligero) | [Principio]: SRP + mínimo privilegio (siempre filtrado por userId) | [Paradigma]: POO + async/await

@Injectable()
export class ListMyVocabularyUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly grammar: CompleteGrammarUseCase,
  ) {}

  async execute(
    userId: string,
    filter: { language?: string; q?: string },
    token?: string,
  ): Promise<VocabularyEntry[]> {
    const base: FindOptionsWhere<VocabularyEntry> = {
      userId,
      ...(filter.language ? { language: filter.language } : {}),
    };
    // [Búsqueda]: en el término o en la traducción (`ILike`: sin distinguir mayúsculas; `%` escapado del texto del usuario)
    const q = filter.q?.trim().replace(/[%_]/g, (c) => `\\${c}`);
    const where = q
      ? [
          { ...base, term: ILike(`%${q}%`) },
          { ...base, translation: ILike(`%${q}%`) },
        ]
      : base;
    const list = await this.entries.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });
    // [2026-11-03 · Regla obligatoria]: las guardadas incompletas (o de antes de la regla) se corrigen solas en segundo plano
    if (token) this.grammar.repairPending(list, token);
    return list;
  }
}

@Injectable()
export class GetVocabularyEntryUseCase {
  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
  ) {}

  async execute(userId: string, id: string): Promise<VocabularyEntry> {
    const entry = await this.entries.findOneBy({ id, userId });
    if (!entry) throw new NotFoundException('Entrada no encontrada');
    return entry;
  }
}
