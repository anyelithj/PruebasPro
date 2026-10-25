import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import {
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
import { GetTermUseCase } from './upsert-terms.use-case';
// [UseCase RemoveTerm · Sprint 10.5]: quita el término de un idioma (la celda queda vacía en la tabla) | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class RemoveTermUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    private readonly get: GetTermUseCase,
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
  ) {}

  async execute(actor: PolyglotActor, id: string): Promise<void> {
    const { term, topicId } = await this.get.load(id);
    await this.access.editable(actor, topicId);
    await this.terms.remove(term);
  }
}
