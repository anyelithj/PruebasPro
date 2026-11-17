import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../shared/domain/interfaces/language-tools.interface';
import { splitSentences } from '../../reading/domain/sentence-splitter';
import { BookTranslation } from '../domain/entities/book-translation.entity';
import { translationChunks } from '../domain/gutenberg-text';
import { clausesOf } from '../domain/clauses';
import { BookTextUseCase } from './book-text.use-case';

// [SentenceIpa]: IPA de la frase + renglones (texto → IPA) para mostrarla renglón a renglón
export interface SentenceIpa {
  ipa: string;
  ipa_us: string | null;
  parts: { text: string; ipa: string }[];
}
// [UseCase BookLanguage · Libros · RF-146 · 2026-11-14]: traducción al español POR PÁRRAFO e IPA POR FRASE, siempre bajo demanda y con caché
// Traducción: el traductor de la plataforma (LanguageToolsPort → FastAPI → LLM local) con el párrafo anterior como contexto (no se traduce;
// aclara el sentido y el registro → traducción natural también en textos antiguos) · se guarda por (libro, capítulo, párrafo, idioma)
// IPA: espeak-ng en FastAPI (determinista, sin LLM) de UNA frase · Redis 30 días · nunca el libro entero
// [Navegador primero]: el cliente usa la Translator API si existe y solo llama aquí si no | [Patrón]: Cache-aside + Ports & Adapters | [Principio]: DIP + DRY

const TARGET = 'es';
const CONTEXT_CHARS = 600; // = máximo de `context` en FastAPI
const IPA_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class BookLanguageUseCase {
  constructor(
    private readonly text: BookTextUseCase,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectRepository(BookTranslation)
    private readonly translations: Repository<BookTranslation>,
  ) {}

  async translate(
    bookId: number,
    chapter: number,
    paragraph: number,
    token: string,
  ): Promise<{ translation: string | null }> {
    const key = { bookId, chapter, paragraph, target: TARGET };
    const saved = await this.translations.findOne({ where: key });
    if (saved) return { translation: saved.text };
    const p = await this.text.paragraph(bookId, chapter, paragraph);
    if (p.language === TARGET) return { translation: null }; // Libro ya en español
    let context = p.previous.slice(-CONTEXT_CHARS);
    const parts: string[] = [];
    for (const chunk of translationChunks(splitSentences(p.text, p.language))) {
      const r = await this.tools.translate(chunk, p.language, TARGET, token, {
        kind: 'frase',
        context,
      });
      parts.push(r.translation.trim());
      context = chunk.slice(-CONTEXT_CHARS); // El trozo anterior da contexto al siguiente
    }
    const text = parts.join(' ');
    await this.translations.save(this.translations.create({ ...key, text }));
    return { translation: text };
  }

  // [2026-11-16]: además de la IPA de la frase entera devuelve `parts` → un renglón (cláusula) con su IPA debajo, como pide el lector
  async sentenceIpa(
    bookId: number,
    chapter: number,
    paragraph: number,
    sentence: number,
    token: string,
  ): Promise<SentenceIpa> {
    const cacheKey = `books:ipa3:${bookId}:${chapter}:${paragraph}:${sentence}`; // `ipa3` (2026-11-17): renglones largos ya partidos → no lee la caché vieja
    const hit = await this.cache.get<SentenceIpa>(cacheKey);
    if (hit) return hit;
    const p = await this.text.paragraph(bookId, chapter, paragraph);
    const s = splitSentences(p.text, p.language)[sentence];
    if (s === undefined) throw new NotFoundException('Frase fuera de rango');
    // `Promise.all`: las cláusulas de una frase se transcriben a la vez (pocas por frase) · 500 = máximo de FastAPI /ipa
    const parts = await Promise.all(
      clausesOf(s.slice(0, 500)).map(async (text) => {
        const r = await this.tools.ipa(text, p.language, token);
        return { text, ipa: r.ipa, ipa_us: r.ipa_us };
      }),
    );
    const out: SentenceIpa = {
      ipa: parts.map((x) => x.ipa).join(' '),
      ipa_us: parts.every((x) => x.ipa_us)
        ? parts.map((x) => x.ipa_us).join(' ')
        : null,
      parts: parts.map(({ text, ipa }) => ({ text, ipa })),
    };
    await this.cache.set(cacheKey, out, IPA_TTL_MS);
    return out;
  }
}
