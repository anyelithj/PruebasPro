import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import { checkedItem, type ItemInput } from './create-activity.use-case';
import { ActivityAccess } from './get-activity.use-case';
import type { PracticeActor } from './list-activities.use-case';
// [UseCase AddItem · Sprint 8.12 · RF-110 a RF-113]: agrega un ítem al final de la actividad (tipo, habilidad, respuestas aceptadas, explicación y consejo) | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (checkedItem valida igual que al crear) | [Paradigma]: POO

@Injectable()
export class AddItemUseCase {
  constructor(
    private readonly access: ActivityAccess,
    @InjectRepository(PracticeItem)
    private readonly items: Repository<PracticeItem>,
  ) {}

  async execute(
    actor: PracticeActor,
    activityId: string,
    input: ItemInput,
  ): Promise<PracticeItem> {
    await this.access.editable(actor, activityId);
    const position = await this.items.countBy({ activityId });
    return this.items.save(
      this.items.create({ ...checkedItem(input), activityId, position }),
    );
  }
}
