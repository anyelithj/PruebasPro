import { Module } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TopicCrudService } from '../../shared/application/topic-crud.service';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { AddConceptUseCase } from './application/use-cases/add-concept.use-case';
import { DeleteViewUseCase } from './application/use-cases/delete-view.use-case';
import { EnrichTermsUseCase } from './application/use-cases/enrich-terms.use-case';
import { GenerateTopicDraftUseCase } from './application/use-cases/generate-topic-draft.use-case';
import {
  GetComparisonTableUseCase,
  GetConceptUseCase,
  POLYGLOT_TOPICS,
  PolyglotTopicAccess,
} from './application/use-cases/get-comparison-table.use-case';
import {
  GetViewUseCase,
  ListMyViewsUseCase,
} from './application/use-cases/list-my-views.use-case';
import { RemoveConceptUseCase } from './application/use-cases/remove-concept.use-case';
import { RemoveTermUseCase } from './application/use-cases/remove-term.use-case';
import { ReviewTermUseCase } from './application/use-cases/review-term.use-case';
import { SaveViewUseCase } from './application/use-cases/save-view.use-case';
import { UpdateConceptUseCase } from './application/use-cases/update-concept.use-case';
import { UpdateViewUseCase } from './application/use-cases/update-view.use-case';
import {
  GetTermUseCase,
  ListTermsUseCase,
  UpsertTermsUseCase,
} from './application/use-cases/upsert-terms.use-case';
import { PolyglotConcept } from './domain/entities/polyglot-concept.entity';
import { PolyglotTerm } from './domain/entities/polyglot-term.entity';
import { PolyglotTopic } from './domain/entities/polyglot-topic.entity';
import { PolyglotView } from './domain/entities/polyglot-view.entity';
import { POLYGLOT_DRAFT } from './domain/interfaces/polyglot-draft.interface';
import { PolyglotDraftClient } from './infrastructure/ai/polyglot-draft-client.adapter';
import { PolyglotTopicSeeder } from './infrastructure/seeds/polyglot-topics.seed';
import { PolyglotConceptsController } from './presentation/polyglot-concepts.controller';
import { PolyglotTermsController } from './presentation/polyglot-terms.controller';
import { PolyglotTopicsController } from './presentation/polyglot-topics.controller';
import { PolyglotViewsController } from './presentation/polyglot-views.controller';
// [PolyglotModule · Sprints 10.5/10.6 · RF-129 a RF-132]: comparador de idiomas por tema — temas, conceptos con emoji o imagen, términos con IPA, vistas guardadas y borrador con IA | [Patrón]: Module + DI Container + Ports & Adapters (LANGUAGE_TOOLS de Vocabulary, POLYGLOT_DRAFT → OllamaClient de AIModule @Global) + Generic Service (TopicCrudService) | [Principio]: DIP + SRP + DRY

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PolyglotTopic,
      PolyglotConcept,
      PolyglotTerm,
      PolyglotView,
    ]),
    VocabularyModule, // LANGUAGE_TOOLS: IPA de cada término (mismo cliente de FastAPI)
  ],
  // [Orden]: «views» antes que el controlador con rutas «polyglot/:algo»
  controllers: [
    PolyglotViewsController,
    PolyglotTopicsController,
    PolyglotConceptsController,
    PolyglotTermsController,
  ],
  providers: [
    {
      provide: POLYGLOT_TOPICS,
      inject: [getRepositoryToken(PolyglotTopic)],
      useFactory: (repo: Repository<PolyglotTopic>) =>
        new TopicCrudService(repo, 'Tema'),
    },
    { provide: POLYGLOT_DRAFT, useClass: PolyglotDraftClient },
    PolyglotTopicAccess,
    GetComparisonTableUseCase,
    GetConceptUseCase,
    AddConceptUseCase,
    UpdateConceptUseCase,
    RemoveConceptUseCase,
    EnrichTermsUseCase,
    UpsertTermsUseCase,
    ListTermsUseCase,
    GetTermUseCase,
    ReviewTermUseCase,
    RemoveTermUseCase,
    SaveViewUseCase,
    ListMyViewsUseCase,
    GetViewUseCase,
    UpdateViewUseCase,
    DeleteViewUseCase,
    GenerateTopicDraftUseCase,
    PolyglotTopicSeeder,
  ],
})
export class PolyglotModule {}
