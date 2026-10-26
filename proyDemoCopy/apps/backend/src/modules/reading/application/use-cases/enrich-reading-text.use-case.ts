import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingSentence } from '../../domain/entities/reading-sentence.entity';
import { ReadingAccess, type ReadingActor } from './reading-access';
import { needsEnrichment } from './reading-content.writer';
import { SentenceEnricher } from './sentence-enricher';
// [UseCase EnrichReadingText · Lectura · 2026-10-25]: «Completar IPA y traducción» — solo las frases a las que les falta (lotes que fallaron al crear); `force` recalcula todas menos las revisadas a mano | [Patrón]: Command + Lazy Backfill | [Principio]: SRP + la corrección manual prevalece + Fail-soft | [Paradigma]: POO + async/await

@Injectable()
export class EnrichReadingTextUseCase {
  constructor(
    private readonly access: ReadingAccess,
    @InjectRepository(ReadingSentence)
    private readonly sentences: Repository<ReadingSentence>,
    private readonly enricher: SentenceEnricher,
  ) {}

  async execute(actor: ReadingActor, id: string, token: string, force = false): Promise<{ updated: number; pending: number }> {
    const text = await this.access.editable(actor, id);
    const all = await this.sentences.find({ where: { textId: id }, order: { position: 'ASC' } });
    const target = all.filter((s) => (force ? !s.reviewed : needsEnrichment(s, text.language)));
    if (!target.length) return { updated: 0, pending: 0 };
    const { items } = await this.enricher.enrich(target.map((s) => s.text), text.language, token);
    // [Fusión]: un dato nuevo vacío NO borra uno existente (lote fallido) | `flatMap`: solo las frases que cambiaron
    const changed = target.flatMap((s, i) => {
      const l = items[i];
      if (!l || (!l.ipa && !l.translation)) return [];
      if (l.ipa) Object.assign(s, { ipa: l.ipa, ipaUs: l.ipaUs });
      if (l.translation) s.translation = l.translation;
      return [s];
    });
    if (changed.length) await this.sentences.save(changed);
    return { updated: changed.length, pending: all.filter((s) => needsEnrichment(s, text.language)).length };
  }
}
