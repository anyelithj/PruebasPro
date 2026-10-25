import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import { GetActivityUseCase } from './get-activity.use-case';
import { ActivityAccess } from './get-activity.use-case';
import type { PracticeActor } from './list-activities.use-case';
// [UseCases ListItems + GetItem · Sprint 8.12]: ítems de una actividad (vista según el rol, DRY con GetActivity) y un ítem completo (solo autor o ADMIN) | [Patrón]: Query | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class ListItemsUseCase {
  constructor(private readonly activity: GetActivityUseCase) {}

  async execute(actor: PracticeActor, activityId: string) {
    return (await this.activity.execute(actor, activityId)).items;
  }
}

@Injectable()
export class GetItemUseCase {
  constructor(
    private readonly access: ActivityAccess,
    @InjectRepository(PracticeItem)
    private readonly items: Repository<PracticeItem>,
  ) {}

  async execute(actor: PracticeActor, id: string): Promise<PracticeItem> {
    const item = await this.items.findOneBy({ id });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    await this.access.editable(actor, item.activityId); // 403 si no es su actividad
    return item;
  }
}
