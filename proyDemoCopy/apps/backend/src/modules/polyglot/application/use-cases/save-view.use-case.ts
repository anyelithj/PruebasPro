import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotView } from '../../domain/entities/polyglot-view.entity';
import { languageOrder } from '../../domain/language-order';
import type { ViewBody } from '../dtos/polyglot.dto';
import {
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
// [UseCase SaveView · Sprint 10.5 · RF-131]: guarda la comparación elegida — tema, idiomas y orden de las columnas | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (languageOrder normaliza el orden) | [Paradigma]: POO

@Injectable()
export class SaveViewUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotView)
    private readonly views: Repository<PolyglotView>,
  ) {}

  async execute(actor: PolyglotActor, body: ViewBody): Promise<PolyglotView> {
    const topic = await this.access.readable(actor, body.topicId); // No se guarda una vista de un tema que no puede ver
    return this.views.save(
      this.views.create({
        userId: actor.id,
        topicId: topic.id,
        name: body.name?.trim() || topic.title,
        languages: languageOrder(body.languages),
      }),
    );
  }
}
