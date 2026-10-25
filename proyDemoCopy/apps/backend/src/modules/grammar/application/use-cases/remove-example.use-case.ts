import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import { type GrammarActor, GrammarAccess } from './list-sections.use-case';
// [UseCase RemoveExample · Sprint 10.9]: quita un ejemplo de la sección | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class RemoveExampleUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
  ) {}

  async execute(actor: GrammarActor, id: string): Promise<void> {
    const { example, section } = await this.access.example(id);
    await this.access.editable(actor, section.topicId);
    await this.examples.remove(example);
  }
}
