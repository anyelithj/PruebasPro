import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PracticeActivity } from '../../domain/entities/practice-activity.entity';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import { toStudentItem } from '../../domain/item-rules';
import { isStaff, type PracticeActor } from './list-activities.use-case';
// [UseCases ActivityAccess + GetActivity · Sprint 8.12]: carga una actividad según el rol (borradores solo para su autor o ADMIN) y la devuelve con sus ítems; al estudiante SIN respuestas correctas | [Patrón]: Query + Guard reutilizable | [Principio]: SRP + mínimo privilegio + DRY | [Paradigma]: POO

@Injectable()
export class ActivityAccess {
  constructor(
    @InjectRepository(PracticeActivity)
    private readonly activities: Repository<PracticeActivity>,
  ) {}

  async readable(actor: PracticeActor, id: string): Promise<PracticeActivity> {
    const a = await this.activities.findOneBy({ id, archivedAt: IsNull() });
    if (!a || (a.status !== 'published' && !this.canEdit(actor, a)))
      throw new NotFoundException('Actividad no encontrada');
    return a;
  }

  async editable(actor: PracticeActor, id: string): Promise<PracticeActivity> {
    const a = await this.activities.findOneBy({ id, archivedAt: IsNull() });
    if (!a) throw new NotFoundException('Actividad no encontrada');
    if (!this.canEdit(actor, a))
      throw new ForbiddenException('Solo el autor o un ADMIN puede editarla');
    return a;
  }

  private canEdit(actor: PracticeActor, a: PracticeActivity): boolean {
    return (
      actor.role === 'ADMIN' || (isStaff(actor) && a.createdBy === actor.id)
    );
  }
}

@Injectable()
export class GetActivityUseCase {
  constructor(
    private readonly access: ActivityAccess,
    @InjectRepository(PracticeItem)
    private readonly items: Repository<PracticeItem>,
  ) {}

  async execute(actor: PracticeActor, id: string) {
    const activity = await this.access.readable(actor, id);
    const items = await this.items.find({
      where: { activityId: id },
      order: { position: 'ASC' },
    });
    // [Autor/ADMIN]: ítems completos para editar · [Estudiante]: sin respuestas
    const full =
      isStaff(actor) &&
      (actor.role === 'ADMIN' || activity.createdBy === actor.id);
    return { ...activity, items: full ? items : items.map(toStudentItem) };
  }
}
