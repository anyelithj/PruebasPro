import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import {
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
// [UseCase RemoveConcept · Sprint 10.5]: quita el concepto y sus términos en una transacción | [Patrón]: Use Case (Command) + Unit of Work | [Principio]: SRP + integridad (sin términos huérfanos) | [Paradigma]: POO

@Injectable()
export class RemoveConceptUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
  ) {}

  async execute(actor: PolyglotActor, id: string): Promise<void> {
    const c = await this.access.concept(id);
    await this.access.editable(actor, c.topicId);
    // `transaction` (TypeORM): términos y concepto se borran juntos
    await this.concepts.manager.transaction(async (tx) => {
      await tx.delete(PolyglotTerm, { conceptId: id });
      await tx.delete(PolyglotConcept, { id });
    });
  }
}
