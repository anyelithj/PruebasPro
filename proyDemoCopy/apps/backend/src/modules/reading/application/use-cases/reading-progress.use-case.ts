import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingProgress } from '../../domain/entities/reading-progress.entity';
import type { ProgressBody } from '../dtos/reading.dto';
import { ReadingAccess, type ReadingActor } from './reading-access';
// [UseCase ReadingProgress · Lectura · 2026-10-25]: guarda el «marcador de lectura» (frase y palabra) para retomar donde se quedó | [Patrón]: Command + Upsert (ON CONFLICT por usuario y texto) | [Principio]: SRP + idempotente (repetir el mismo marcador no duplica) | [Paradigma]: POO + async/await

@Injectable()
export class SaveReadingProgressUseCase {
  constructor(
    private readonly access: ReadingAccess,
    @InjectRepository(ReadingProgress)
    private readonly progress: Repository<ReadingProgress>,
  ) {}

  async execute(actor: ReadingActor, textId: string, body: ProgressBody) {
    const text = await this.access.readable(actor, textId); // Solo lecturas visibles para el usuario
    // [Acotar]: la frase nunca pasa de la última del texto (el cliente no se confía)
    const sentence = Math.min(body.sentence, Math.max(text.sentenceCount - 1, 0));
    const prev = await this.progress.findOneBy({ userId: actor.id, textId });
    const finished = Boolean(prev?.finished || body.finished); // Una vez terminada, queda terminada (aunque vuelva a empezar)
    // `upsert` (TypeORM → INSERT … ON CONFLICT DO UPDATE): una fila por usuario y texto
    await this.progress.upsert(
      { userId: actor.id, textId, sentenceIndex: sentence, wordIndex: body.word ?? 0, finished },
      { conflictPaths: ['userId', 'textId'] },
    );
    return { sentence, word: body.word ?? 0, finished };
  }

  // [reset]: «Empezar de nuevo» → borra el marcador
  async reset(actor: ReadingActor, textId: string): Promise<void> {
    await this.progress.delete({ userId: actor.id, textId });
  }
}
