import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingProgress } from '../../domain/entities/reading-progress.entity';
import { ReadingSentence } from '../../domain/entities/reading-sentence.entity';
import { ReadingAccess, type ReadingActor } from './reading-access';
import { needsEnrichment } from './reading-content.writer';
// [UseCase GetReadingText · Lectura · 2026-10-25]: texto con sus frases (traducción e IPA), si es editable y el marcador del usuario — UNA petición para el lector | [Patrón]: Query + Read Model | [Principio]: SRP + mínimo privilegio (ReadingAccess) | [Paradigma]: POO + async/await

@Injectable()
export class GetReadingTextUseCase {
  constructor(
    private readonly access: ReadingAccess,
    @InjectRepository(ReadingSentence)
    private readonly sentences: Repository<ReadingSentence>,
    @InjectRepository(ReadingProgress)
    private readonly progress: Repository<ReadingProgress>,
  ) {}

  async execute(actor: ReadingActor, id: string) {
    const text = await this.access.readable(actor, id);
    // `Promise.all` (ES2015): frases y marcador en paralelo
    const [sentences, mark] = await Promise.all([
      this.sentences.find({ where: { textId: id }, order: { position: 'ASC' } }),
      this.progress.findOneBy({ userId: actor.id, textId: id }),
    ]);
    return {
      ...text,
      sentences,
      editable: this.access.canEdit(actor, text),
      pending: sentences.filter((s) => needsEnrichment(s, text.language)).length,
      progress: mark ? { sentence: mark.sentenceIndex, word: mark.wordIndex, finished: mark.finished, updatedAt: mark.updatedAt } : null,
    };
  }

  // [sentencesOf]: frases ordenadas (exportar y completar) | DRY con execute
  sentencesOf(textId: string): Promise<ReadingSentence[]> {
    return this.sentences.find({ where: { textId }, order: { position: 'ASC' } });
  }
}
