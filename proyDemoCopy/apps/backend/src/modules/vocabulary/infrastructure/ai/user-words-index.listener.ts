import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import jwtConfig from '../../../../shared/config/jwt.config';
import { AssistantClientService } from '../../../ai/assistant-client.service';
import { VocabularyEntry } from '../../domain/entities/vocabulary-entry.entity';
import {
  WORD_MARKED_TO_LEARN_EVENT,
  type WordMarkedToLearnEvent,
} from '../../domain/events/word-marked-to-learn.event';
// [Listener UserWordsIndex · 2026-11-14 · RF-137]: palabra marcada «aprender» (también desde el lector de libros) → índice RAG del tutor
// SOLO la palabra y su traducción, como fragmento privado del usuario (FastAPI toma el dueño del token) · nunca libros ni textos completos
// [Patrón]: Observer (Domain Event) + Adapter | [Principio]: OCP (Vocabulary no conoce FAISS) + Fail-soft (si FastAPI cae, la marca se guarda igual)

@Injectable()
export class UserWordsIndexListener {
  private readonly logger = new Logger(UserWordsIndexListener.name);

  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    private readonly assistant: AssistantClientService,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  @OnEvent(WORD_MARKED_TO_LEARN_EVENT, { async: true })
  async handle(event: WordMarkedToLearnEvent): Promise<void> {
    try {
      const e = await this.entries.findOne({
        where: { id: event.entryId, userId: event.userId },
      });
      if (!e) return;
      // Token de servicio de 2 min con el usuario como sujeto → FastAPI guarda el fragmento a su nombre
      const token = await this.jwt.signAsync(
        { sub: event.userId, role: 'USER', svc: 'user-words-rag' },
        { secret: this.cfg.accessSecret, expiresIn: 120 },
      );
      await this.assistant.indexUserWords(
        [
          {
            id: e.id,
            language: e.language,
            term: e.term,
            translation: e.translation,
          },
        ],
        token,
      );
    } catch (err) {
      this.logger.warn(
        `Palabra sin indexar en el RAG: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
