import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { Dialogue } from '../../domain/entities/dialogue.entity';
import type { DialogueActor } from './get-dialogue.use-case';
// [UseCase ListDialogues · Sprint 9.3 · RF-125/RF-127]: biblioteca por idioma, nivel y tema — con nivel confirmado para todos; «mine=true» devuelve los propios (cualquier estado) al docente; el ADMIN ve también los pendientes de confirmar | [Patrón]: Query + Soft Delete | [Principio]: SRP + verificación humana | [Paradigma]: POO

@Injectable()
export class ListDialoguesUseCase {
  constructor(
    @InjectRepository(Dialogue)
    private readonly dialogues: Repository<Dialogue>,
  ) {}

  execute(
    actor: DialogueActor,
    f: {
      language?: string;
      level?: string;
      topic?: string;
      mine?: boolean;
      pending?: boolean;
    },
  ): Promise<Dialogue[]> {
    const where: FindOptionsWhere<Dialogue> = {
      withdrawnAt: IsNull(),
      ...(f.language ? { language: f.language } : {}),
      ...(f.level ? { level: f.level } : {}),
      ...(f.topic ? { topicId: f.topic } : {}),
    };
    if (f.mine) where.createdBy = actor.id;
    else if (actor.role === 'ADMIN' && f.pending)
      where.levelStatus = 'estimated';
    else where.levelStatus = 'confirmed';
    return this.dialogues.find({
      where,
      order: { level: 'ASC', title: 'ASC' },
    });
  }
}
