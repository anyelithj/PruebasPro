import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingProgress } from '../../domain/entities/reading-progress.entity';
import { ReadingSentence } from '../../domain/entities/reading-sentence.entity';
import { ReadingAccess, type ReadingActor } from './reading-access';
import {
  needsEnrichment,
  ReadingContentWriter,
} from './reading-content.writer';
// [UseCase GetReadingText · Lectura · 2026-10-25]: texto con sus frases (traducción e IPA), si es editable y el marcador del usuario — UNA petición para el lector | [Patrón]: Query + Read Model | [Principio]: SRP + mínimo privilegio (ReadingAccess) | [Paradigma]: POO + async/await

@Injectable()
export class GetReadingTextUseCase {
  constructor(
    private readonly access: ReadingAccess,
    @InjectRepository(ReadingSentence)
    private readonly sentences: Repository<ReadingSentence>,
    @InjectRepository(ReadingProgress)
    private readonly progress: Repository<ReadingProgress>,
    private readonly writer: ReadingContentWriter, // [2026-10-27]: saber si la IPA/traducción se está generando · [2026-10-28]: y programar el relleno perezoso al leer
  ) {}

  // [execute]: `token` (JWT del lector) → si faltan traducciones/IPA se completan en segundo plano y se guardan (la columna derecha del lector no queda vacía)
  async execute(actor: ReadingActor, id: string, token = '') {
    const text = await this.access.readable(actor, id);
    // `Promise.all` (ES2015): frases y marcador en paralelo
    const [sentences, mark] = await Promise.all([
      this.sentences.find({
        where: { textId: id },
        order: { position: 'ASC' },
      }),
      this.progress.findOneBy({ userId: actor.id, textId: id }),
    ]);
    const pending = sentences.filter((s) =>
      needsEnrichment(s, text.language),
    ).length;
    return {
      ...text,
      sentences,
      editable: this.access.canEdit(actor, text),
      pending,
      // [2026-10-27]: `true` → la UI muestra «Generando IPA/traducción…» y vuelve a consultar · [2026-10-28]: con frases pendientes el propio GET programa el relleno (backfill)
      enriching: pending
        ? this.writer.backfill(id, text.language, token)
        : this.writer.isEnriching(id),
      progress: mark
        ? {
            sentence: mark.sentenceIndex,
            word: mark.wordIndex,
            finished: mark.finished,
            updatedAt: mark.updatedAt,
          }
        : null,
    };
  }

  // [sentencesOf]: frases ordenadas (exportar y completar) | DRY con execute
  sentencesOf(textId: string): Promise<ReadingSentence[]> {
    return this.sentences.find({
      where: { textId },
      order: { position: 'ASC' },
    });
  }
}
