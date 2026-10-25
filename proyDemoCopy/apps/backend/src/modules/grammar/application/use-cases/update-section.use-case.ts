import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarSection } from '../../domain/entities/grammar-section.entity';
import type { UpdateSectionBody } from '../dtos/grammar.dto';
import { type GrammarActor, GrammarAccess } from './list-sections.use-case';
// [UseCase UpdateSection · Sprint 10.9]: edita el tipo, el título, el texto o el orden de una sección | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class UpdateSectionUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
  ) {}

  async execute(
    actor: GrammarActor,
    id: string,
    patch: UpdateSectionBody,
  ): Promise<GrammarSection> {
    const s = await this.access.section(id);
    await this.access.editable(actor, s.topicId);
    Object.assign(
      s,
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    );
    return this.sections.save(s);
  }
}
