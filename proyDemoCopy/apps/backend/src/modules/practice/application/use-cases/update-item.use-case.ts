import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import { checkedItem, type ItemInput } from './create-activity.use-case';
import { GetItemUseCase } from './list-items.use-case';
import type { PracticeActor } from './list-activities.use-case';
// [UseCase UpdateItem · Sprint 8.12]: edita un ítem y vuelve a validar su coherencia con el resultado final | [Patrón]: Use Case (Command) | [Principio]: SRP + Fail Fast + DRY | [Paradigma]: POO

@Injectable()
export class UpdateItemUseCase {
  constructor(
    private readonly get: GetItemUseCase,
    @InjectRepository(PracticeItem)
    private readonly items: Repository<PracticeItem>,
  ) {}

  async execute(
    actor: PracticeActor,
    id: string,
    patch: Partial<ItemInput>,
  ): Promise<PracticeItem> {
    const item = await this.get.execute(actor, id);
    const next = checkedItem({
      itemType: patch.itemType ?? item.itemType,
      skill: patch.skill ?? item.skill,
      prompt: patch.prompt ?? item.prompt,
      options: patch.options ?? item.options,
      accepted: patch.accepted ?? item.accepted,
      corrections: patch.corrections ?? item.corrections,
      explanation: patch.explanation ?? item.explanation,
      tip: patch.tip ?? item.tip,
    });
    return this.items.save(Object.assign(item, next));
  }
}
