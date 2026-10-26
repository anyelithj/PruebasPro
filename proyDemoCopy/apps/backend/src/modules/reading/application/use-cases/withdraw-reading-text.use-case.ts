import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingText } from '../../domain/entities/reading-text.entity';
import { ReadingAccess, type ReadingActor } from './reading-access';
// [UseCase WithdrawReadingText · Lectura · 2026-10-25]: retira la lectura (borrado lógico: deja de listarse y de abrirse; las frases y marcadores se conservan para auditoría) | [Patrón]: Soft Delete | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class WithdrawReadingTextUseCase {
  constructor(
    private readonly access: ReadingAccess,
    @InjectRepository(ReadingText)
    private readonly texts: Repository<ReadingText>,
  ) {}

  async execute(actor: ReadingActor, id: string): Promise<void> {
    const t = await this.access.editable(actor, id);
    Object.assign(t, { withdrawnAt: new Date(), status: 'draft' });
    await this.texts.save(t);
  }
}
