import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TopicCrudService } from '../../../../shared/application/topic-crud.service';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import { GrammarSection } from '../../domain/entities/grammar-section.entity';
import type { GrammarTopic } from '../../domain/entities/grammar-topic.entity';
import {
  GRAMMAR_DRAFT,
  type GrammarDraftPort,
} from '../../domain/interfaces/grammar-draft.interface';
import type { GrammarDraftBody } from '../dtos/grammar.dto';
import { EnrichExampleUseCase } from './enrich-example.use-case';
import { GRAMMAR_TOPICS, type GrammarActor } from './list-sections.use-case';
// [UseCase GenerateTopicDraft (Grammar) · Sprint 10.10 · RF-135]: pide a Ollama (vía GrammarDraftPort) una ficha con secciones y ejemplos y la guarda como BORRADOR; el IPA y la traducción de los ejemplos los pone FastAPI (no el LLM) y el docente revisa explicaciones y ejemplos antes de publicar | [Patrón]: Use Case (Command) + Ports & Adapters + Unit of Work | [Principio]: determinístico primero + verificación humana + DRY (TopicCrudService, EnrichExample) | [Paradigma]: POO + async/await

@Injectable()
export class GenerateTopicDraftUseCase {
  constructor(
    @Inject(GRAMMAR_TOPICS)
    private readonly topics: TopicCrudService<GrammarTopic>,
    @Inject(GRAMMAR_DRAFT) private readonly draft: GrammarDraftPort,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
    private readonly enrich: EnrichExampleUseCase,
  ) {}

  async execute(actor: GrammarActor, body: GrammarDraftBody, token: string) {
    // [Orden]: primero el LLM y luego la ficha → si la IA falla no queda una ficha vacía (TopicCrudService valida el nombre único al crear)
    const res = await this.draft.draft({
      title: body.title,
      language: body.language,
      level: body.level,
    });
    const topic = await this.topics.create(actor.id, {
      title: body.title,
      language: body.language,
      levels: [body.level],
      summary: res.summary,
      status: 'draft',
      model: res.model,
    });
    const exampleIds: string[] = [];
    // `transaction` (TypeORM): secciones y ejemplos entran juntos
    await this.sections.manager.transaction(async (tx) => {
      for (const [position, s] of res.sections.entries()) {
        const section = await tx.save(
          tx.create(GrammarSection, {
            topicId: topic.id,
            position,
            type: s.type,
            title: s.title,
            body: s.body,
          }),
        );
        const saved = await tx.save(
          s.examples.map((text, i) =>
            tx.create(GrammarExample, {
              sectionId: section.id,
              position: i,
              text,
              ipa: '',
              ipaUs: null,
              translation: null,
              reviewed: false,
            }),
          ),
        );
        exampleIds.push(...saved.map((e) => e.id));
      }
    });
    await this.enrich.execute(exampleIds, body.language, token);
    return { id: topic.id, sections: res.sections.length, model: res.model };
  }
}
