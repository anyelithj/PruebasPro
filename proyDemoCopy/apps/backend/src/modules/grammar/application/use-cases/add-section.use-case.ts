import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarSection } from '../../domain/entities/grammar-section.entity';
import type { SectionBody } from '../dtos/grammar.dto';
import { type GrammarActor, GrammarAccess } from './list-sections.use-case';
// [UseCase AddSection · Sprint 10.9 · RF-133]: agrega una sección (uso, fórmula, negativa, interrogativa, nota o errores comunes) al final de la ficha o en la posición indicada | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class AddSectionUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
  ) {}

  async execute(
    actor: GrammarActor,
    topicId: string,
    body: SectionBody,
  ): Promise<GrammarSection> {
    await this.access.editable(actor, topicId);
    const last = await this.sections.findOne({
      where: { topicId },
      order: { position: 'DESC' },
    });
    return this.sections.save(
      this.sections.create({
        topicId,
        type: body.type,
        title: body.title ?? '',
        body: body.body ?? '',
        position: body.position ?? (last ? last.position + 1 : 0),
      }),
    );
  }
}
