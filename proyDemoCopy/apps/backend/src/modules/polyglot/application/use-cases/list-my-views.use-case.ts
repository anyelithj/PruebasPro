import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotView } from '../../domain/entities/polyglot-view.entity';
// [UseCases ListMyViews + GetView · Sprint 10.5 · RF-131]: comparaciones guardadas del usuario y el detalle de una (solo el dueño) | [Patrón]: Query (CQRS ligero) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class ListMyViewsUseCase {
  constructor(
    @InjectRepository(PolyglotView)
    private readonly views: Repository<PolyglotView>,
  ) {}

  execute(userId: string): Promise<PolyglotView[]> {
    return this.views.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
  }
}

@Injectable()
export class GetViewUseCase {
  constructor(
    @InjectRepository(PolyglotView)
    private readonly views: Repository<PolyglotView>,
  ) {}

  async execute(userId: string, id: string): Promise<PolyglotView> {
    const v = await this.views.findOneBy({ id, userId });
    if (!v) throw new NotFoundException('Comparación no encontrada');
    return v;
  }
}
