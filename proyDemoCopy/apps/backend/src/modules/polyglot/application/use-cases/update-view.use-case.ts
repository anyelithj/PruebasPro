import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotView } from '../../domain/entities/polyglot-view.entity';
import { languageOrder } from '../../domain/language-order';
import type { UpdateViewBody } from '../dtos/polyglot.dto';
import { GetViewUseCase } from './list-my-views.use-case';
// [UseCase UpdateView · Sprint 10.5 · RF-131]: cambia el nombre, los idiomas o su orden de una comparación guardada | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class UpdateViewUseCase {
  constructor(
    @InjectRepository(PolyglotView)
    private readonly views: Repository<PolyglotView>,
    private readonly get: GetViewUseCase,
  ) {}

  async execute(
    userId: string,
    id: string,
    patch: UpdateViewBody,
  ): Promise<PolyglotView> {
    const v = await this.get.execute(userId, id);
    if (patch.name !== undefined) v.name = patch.name.trim() || v.name;
    if (patch.languages) v.languages = languageOrder(patch.languages);
    return this.views.save(v); // El tema no cambia: otra comparación = otra vista
  }
}
