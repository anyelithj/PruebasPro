import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeActivity } from '../../domain/entities/practice-activity.entity';
import { ActivityAccess } from './get-activity.use-case';
import type { PracticeActor } from './list-activities.use-case';
// [UseCase ArchiveActivity · Sprint 8.12]: borrado lógico (los intentos antiguos siguen apuntando a la actividad) | [Patrón]: Soft Delete | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class ArchiveActivityUseCase {
  constructor(
    private readonly access: ActivityAccess,
    @InjectRepository(PracticeActivity)
    private readonly activities: Repository<PracticeActivity>,
  ) {}

  async execute(actor: PracticeActor, id: string): Promise<void> {
    const activity = await this.access.editable(actor, id);
    activity.archivedAt = new Date();
    await this.activities.save(activity);
  }
}
