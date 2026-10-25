import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import { GrammarSection } from '../../domain/entities/grammar-section.entity';
import { type GrammarActor, GrammarAccess } from './list-sections.use-case';
// [UseCase RemoveSection · Sprint 10.9]: quita la sección y sus ejemplos en una transacción | [Patrón]: Use Case (Command) + Unit of Work | [Principio]: SRP + integridad (sin ejemplos huérfanos) | [Paradigma]: POO

@Injectable()
export class RemoveSectionUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
  ) {}

  async execute(actor: GrammarActor, id: string): Promise<void> {
    const s = await this.access.section(id);
    await this.access.editable(actor, s.topicId);
    await this.sections.manager.transaction(async (tx) => {
      await tx.delete(GrammarExample, { sectionId: id });
      await tx.delete(GrammarSection, { id });
    });
  }
}
