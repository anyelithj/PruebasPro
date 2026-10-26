import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { ReadingText } from '../../domain/entities/reading-text.entity';
import type { ReadingActor } from './reading-access';
// [UseCase ListReadingTexts · Lectura · 2026-10-25]: lista por idioma, nivel y género — publicados para todos; «mine» = Gestión (el docente ve los suyos en cualquier estado, el ADMIN todos) | [Patrón]: Query + Soft Delete | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

export interface ReadingFilter {
  language?: string;
  level?: string;
  genre?: string;
  mine?: boolean;
}

@Injectable()
export class ListReadingTextsUseCase {
  constructor(
    @InjectRepository(ReadingText)
    private readonly texts: Repository<ReadingText>,
  ) {}

  execute(actor: ReadingActor, f: ReadingFilter): Promise<ReadingText[]> {
    const where: FindOptionsWhere<ReadingText> = {
      withdrawnAt: IsNull(),
      ...(f.language ? { language: f.language } : {}),
      ...(f.level ? { level: f.level } : {}),
      ...(f.genre ? { genre: f.genre as ReadingText['genre'] } : {}),
    };
    const staff = actor.role === 'TEACHER' || actor.role === 'ADMIN';
    if (f.mine && staff) {
      if (actor.role !== 'ADMIN') where.createdBy = actor.id; // El ADMIN gestiona todos
    } else where.status = 'published';
    return this.texts.find({ where, order: { level: 'ASC', title: 'ASC' }, take: 500 });
  }
}
