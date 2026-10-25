import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import {
  POLYGLOT_DRAFT,
  type PolyglotDraftPort,
} from '../../domain/interfaces/polyglot-draft.interface';
import type { PolyglotDraftBody } from '../dtos/polyglot.dto';
import { AddConceptUseCase } from './add-concept.use-case';
import {
  POLYGLOT_TOPICS,
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
import { UpsertTermsUseCase } from './upsert-terms.use-case';
import type { TopicCrudService } from '../../../../shared/application/topic-crud.service';
import { isLanguage, type Language } from '../../../../shared/domain/language.vo';
import type { PolyglotTopic } from '../../domain/entities/polyglot-topic.entity';
// [UseCase GenerateTopicDraft · Sprint 10.6 · RF-132]: pide a Ollama (vía PolyglotDraftPort) conceptos nuevos del tema en los siete idiomas con emoji sugerido y los guarda como BORRADOR (términos sin revisar, IPA de FastAPI); el tema no se publica hasta que el docente lo revisa | [Patrón]: Use Case (Command) + Ports & Adapters + Filter (descarta lo incompleto) | [Principio]: determinístico primero (el IPA no lo inventa el LLM) + verificación humana + DRY (AddConcept y UpsertTerms) | [Paradigma]: POO + async/await

@Injectable()
export class GenerateTopicDraftUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @Inject(POLYGLOT_DRAFT) private readonly draft: PolyglotDraftPort,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
    private readonly addConcept: AddConceptUseCase,
    private readonly upsertTerms: UpsertTermsUseCase,
    @Inject(POLYGLOT_TOPICS)
    private readonly topics: TopicCrudService<PolyglotTopic>,
  ) {}

  async execute(
    actor: PolyglotActor,
    topicId: string,
    body: PolyglotDraftBody,
    token: string,
  ): Promise<{ added: number; model: string }> {
    const topic = await this.access.editable(actor, topicId);
    const existing = await this.concepts.find({
      where: { topicId: topic.id },
      select: { gloss: true },
    });
    const { concepts, model } = await this.draft.draft({
      topic: topic.title,
      kind: body.kind ?? 'word',
      count: body.count ?? 8,
      exclude: existing.map((c) => c.gloss).filter(Boolean),
    });
    let added = 0;
    for (const d of concepts) {
      const terms = Object.entries(d.terms)
        .filter(([lang, text]) => isLanguage(lang) && text.trim())
        .map(([language, text]) => ({
          language: language as Language,
          text: text.trim().slice(0, 200),
        }));
      if (terms.length < 2) continue; // [Filtro]: un concepto con un solo idioma no sirve para comparar
      const c = await this.addConcept.execute(actor, topic.id, {
        kind: d.kind,
        emoji: d.emoji.slice(0, 16),
        gloss: d.gloss.slice(0, 160),
      });
      await this.upsertTerms.execute(actor, c.id, terms, token);
      added++;
    }
    // [Regla]: un tema publicado con conceptos nuevos sin revisar vuelve a borrador
    if (topic.status === 'published' && added)
      await this.topics.update(topic.id, { status: 'draft' });
    return { added, model };
  }
}
