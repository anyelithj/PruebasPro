import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotView } from '../../domain/entities/polyglot-view.entity';
import { GetViewUseCase } from './list-my-views.use-case';
// [UseCase DeleteView · Sprint 10.5 · RF-131]: borra una comparación guardada propia | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio (404 si no es del usuario) | [Paradigma]: POO

@Injectable()
export class DeleteViewUseCase {
  constructor(
    @InjectRepository(PolyglotView)
    private readonly views: Repository<PolyglotView>,
    private readonly get: GetViewUseCase,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    await this.views.remove(await this.get.execute(userId, id));
  }
}
