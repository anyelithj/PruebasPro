import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { assertUniqueTitle } from '../../../../shared/application/unique-title'; // [2026-10-28]: regla anti-duplicados compartida (DRY)
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
    // [Fix 2026-10-28 · Sin duplicados]: cambio de título, nivel o habilidad que choca con otra actividad vigente → 409 (la propia no cuenta)
    if (patch.title !== undefined || patch.level !== undefined || patch.skill !== undefined) {
      const level = patch.level ?? activity.level;
      await assertUniqueTitle(
        this.activities,
        patch.title ?? activity.title,
        { language: activity.language, level, skill: patch.skill ?? activity.skill, archivedAt: IsNull() },
        { label: 'una actividad de práctica', language: activity.language, level },
        activity.id,
      );
    }
    Object.assign(
      activity,
      Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ),
    );
    return this.activities.save(activity);
  }
}
