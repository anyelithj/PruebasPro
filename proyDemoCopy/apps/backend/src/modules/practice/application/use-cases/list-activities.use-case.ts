import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { PracticeActivity } from '../../domain/entities/practice-activity.entity';
// [UseCase ListActivities · Sprint 8.12 · RF-110]: actividades por idioma, nivel y habilidad — el estudiante ve solo publicadas; el docente ve también sus borradores | [Patrón]: Query + Soft Delete | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

export interface PracticeActor {
  id: string;
  role: string; // USER | TEACHER | ADMIN
}
export const isStaff = (a: PracticeActor): boolean =>
  a.role === 'TEACHER' || a.role === 'ADMIN';

@Injectable()
export class ListActivitiesUseCase {
  constructor(
    @InjectRepository(PracticeActivity)
    private readonly activities: Repository<PracticeActivity>,
  ) {}

  execute(
    actor: PracticeActor,
    filter: {
      language?: string;
      level?: string;
      skill?: string;
      mine?: boolean;
    },
  ): Promise<PracticeActivity[]> {
    const base: FindOptionsWhere<PracticeActivity> = {
      archivedAt: IsNull(),
      ...(filter.language ? { language: filter.language } : {}),
      ...(filter.level ? { level: filter.level } : {}),
      ...(filter.skill
        ? { skill: filter.skill as PracticeActivity['skill'] }
        : {}),
    };
    // [Constructor del docente]: `mine` → solo las suyas (borradores incluidos) · resto: publicadas
    const where =
      isStaff(actor) && filter.mine
        ? { ...base, createdBy: actor.id }
        : { ...base, status: 'published' as const };
    return this.activities.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 200,
    });
  }
}
