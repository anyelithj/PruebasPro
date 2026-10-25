import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PracticeActivity,
  type ActivityStatus,
} from '../../domain/entities/practice-activity.entity';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import type { ActivityContent, Skill } from '../../domain/item-type';
import { ActivityAccess } from './get-activity.use-case';
import type { PracticeActor } from './list-activities.use-case';
// [UseCase UpdateActivity · Sprint 8.12 · RF-114]: edita y publica la actividad (publicar exige al menos un ítem; publicar un borrador de IA = revisión del docente hecha) | [Patrón]: Use Case (Command) + State (draft ↔ published) | [Principio]: SRP + revisión humana | [Paradigma]: POO

export interface ActivityPatch {
  title?: string;
  description?: string;
  level?: string;
  skill?: Skill;
  status?: ActivityStatus;
  contents?: ActivityContent[]; // [2026-10-23]: reemplaza la lista de contenidos vinculados
}

@Injectable()
export class UpdateActivityUseCase {
  constructor(
    private readonly access: ActivityAccess,
    @InjectRepository(PracticeActivity)
    private readonly activities: Repository<PracticeActivity>,
    @InjectRepository(PracticeItem)
    private readonly items: Repository<PracticeItem>,
  ) {}

  async execute(
    actor: PracticeActor,
    id: string,
    patch: ActivityPatch,
  ): Promise<PracticeActivity> {
    const activity = await this.access.editable(actor, id);
    if (
      patch.status === 'published' &&
      !(await this.items.existsBy({ activityId: id }))
    )
      throw new BadRequestException(
        'Agrega al menos un ítem antes de publicar',
      );
    Object.assign(
      activity,
      Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ),
    );
    return this.activities.save(activity);
  }
}
