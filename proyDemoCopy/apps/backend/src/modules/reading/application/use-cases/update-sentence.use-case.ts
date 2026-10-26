import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingSentence } from '../../domain/entities/reading-sentence.entity';
import { ReadingText } from '../../domain/entities/reading-text.entity';
import { countWords } from '../../domain/sentence-splitter';
import type { UpdateSentenceBody } from '../dtos/reading.dto';
import { ReadingAccess, type ReadingActor } from './reading-access';
import { SentenceEnricher } from './sentence-enricher';
// [UseCase UpdateSentence · Lectura · 2026-10-25]: el docente corrige una frase, su traducción o su IPA; si cambia el texto y no envía IPA/traducción se recalculan | [Patrón]: Command + verificación humana (`reviewed`) | [Principio]: SRP + la corrección manual prevalece | [Paradigma]: POO + async/await

@Injectable()
export class UpdateSentenceUseCase {
  constructor(
    private readonly access: ReadingAccess,
    @InjectRepository(ReadingSentence)
    private readonly sentences: Repository<ReadingSentence>,
    @InjectRepository(ReadingText)
    private readonly texts: Repository<ReadingText>,
    private readonly enricher: SentenceEnricher,
  ) {}

  async execute(actor: ReadingActor, textId: string, sentenceId: string, body: UpdateSentenceBody, token: string): Promise<ReadingSentence> {
    const text = await this.access.editable(actor, textId);
    const s = await this.sentences.findOneBy({ id: sentenceId, textId });
    if (!s) throw new NotFoundException('Frase no encontrada');
    const changedText = body.text !== undefined && body.text !== s.text;
    if (changedText) s.text = body.text!;
    // [Recalcular]: solo lo que el docente no escribió a mano
    if (changedText && (body.ipa === undefined || body.translation === undefined)) {
      const [l] = (await this.enricher.enrich([s.text], text.language, token)).items;
      if (l && body.ipa === undefined) Object.assign(s, { ipa: l.ipa, ipaUs: l.ipaUs });
      if (l && body.translation === undefined) s.translation = l.translation;
    }
    if (body.translation !== undefined) s.translation = body.translation.trim() || null;
    if (body.ipa !== undefined) s.ipa = body.ipa.trim();
    if (body.ipaUs !== undefined) s.ipaUs = body.ipaUs.trim() || null;
    s.reviewed = true;
    const saved = await this.sentences.save(s);
    if (changedText) {
      // [Contador de palabras]: se recalcula con todas las frases (barato: un texto ≤ 400 frases)
      const all = await this.sentences.find({ where: { textId }, select: { text: true } });
      text.wordCount = countWords(all.map((x) => x.text).join(' '), text.language);
      await this.texts.save(text);
    }
    return saved;
  }
}
