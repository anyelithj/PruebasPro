import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingSentence } from '../../domain/entities/reading-sentence.entity';
import { ReadingText } from '../../domain/entities/reading-text.entity';
import { ReadingGenre } from '../../domain/reading-genre';
import { buildSentences, countWords } from '../../domain/sentence-splitter';
import { SentenceEnricher } from './sentence-enricher';
// [ReadingContentWriter · Lectura · 2026-10-25]: escribe el CONTENIDO de un texto — párrafos → frases → traducción + IPA por lotes → filas — en una transacción | [Patrón]: Domain Service + Unit of Work (transacción TypeORM) + Memoization (reutiliza la traducción de frases idénticas) | [Principio]: SRP + DRY (crear y reemplazar el texto comparten el flujo) | [Paradigma]: POO + async/await
// [Reutilización]: al editar el texto, las frases que no cambiaron conservan su traducción/IPA (incluida la corrección manual del docente) → solo se piden las nuevas

export interface WriteResult {
  sentences: ReadingSentence[];
  pending: number; // Frases sin IPA o sin traducción (lote fallido) → «Completar IPA y traducción»
}

@Injectable()
export class ReadingContentWriter {
  constructor(
    @InjectRepository(ReadingSentence)
    private readonly sentences: Repository<ReadingSentence>,
    private readonly enricher: SentenceEnricher,
  ) {}

  // [write]: reemplaza todas las frases del texto (borrar + insertar en la misma transacción) y actualiza los contadores
  async write(text: ReadingText, paragraphs: readonly string[], token: string, previous: readonly ReadingSentence[] = []): Promise<WriteResult> {
    const drafts = buildSentences(paragraphs, text.language, text.genre === ReadingGenre.POEM);
    // `Map` (ES2015): texto exacto → frase anterior (la última gana) → se conserva traducción/IPA/revisión
    const known = new Map(previous.map((s) => [s.text, s]));
    const fresh = drafts.filter((d) => !known.get(d.text)?.ipa);
    const { items } = fresh.length ? await this.enricher.enrich(fresh.map((d) => d.text), text.language, token) : { items: [] };
    const ling = new Map(fresh.map((d, i) => [d.position, items[i]]));
    const rows = drafts.map((d) => {
      const old = known.get(d.text);
      const l = ling.get(d.position);
      return this.sentences.create({
        textId: text.id,
        paragraph: d.paragraph,
        position: d.position,
        text: d.text,
        translation: l ? l.translation : (old?.translation ?? null),
        ipa: l ? l.ipa : (old?.ipa ?? ''),
        ipaUs: l ? l.ipaUs : (old?.ipaUs ?? null),
        reviewed: !l && !!old?.reviewed,
      });
    });
    text.sentenceCount = rows.length;
    text.wordCount = countWords(drafts.map((d) => d.text).join(' '), text.language);
    // `manager.transaction` (TypeORM): todo o nada — nunca queda un texto a medias
    const saved = await this.sentences.manager.transaction(async (em) => {
      await em.delete(ReadingSentence, { textId: text.id });
      await em.save(ReadingText, text);
      return em.save(ReadingSentence, rows);
    });
    return { sentences: saved, pending: saved.filter((s) => needsEnrichment(s, text.language)).length };
  }
}

// [needsEnrichment]: falta IPA, o falta traducción en un texto que no es español | Función pura (la usan escribir, completar y la vista)
export const needsEnrichment = (s: Pick<ReadingSentence, 'ipa' | 'translation'>, language: string): boolean =>
  !s.ipa?.trim() || (language !== 'es' && !s.translation?.trim());
