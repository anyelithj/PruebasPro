import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import { GetItemUseCase } from './list-items.use-case';
import type { PracticeActor } from './list-activities.use-case';
// [UseCase RemoveItem · Sprint 8.12]: quita un ítem (los intentos guardan su retroalimentación aunque el ítem desaparezca) | [Patrón]: Use Case (Command) | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class RemoveItemUseCase {
  constructor(
    private readonly get: GetItemUseCase,
    @InjectRepository(PracticeItem)
    private readonly items: Repository<PracticeItem>,
  ) {}

  async execute(actor: PracticeActor, id: string): Promise<void> {
    await this.items.remove(await this.get.execute(actor, id));
  }
}
