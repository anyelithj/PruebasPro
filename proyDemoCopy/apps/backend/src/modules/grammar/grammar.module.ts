import { Module } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TopicCrudService } from '../../shared/application/topic-crud.service';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { AddExampleUseCase } from './application/use-cases/add-example.use-case';
import { AddSectionUseCase } from './application/use-cases/add-section.use-case';
import { EnrichExampleUseCase } from './application/use-cases/enrich-example.use-case';
import { GenerateTopicDraftUseCase } from './application/use-cases/generate-topic-draft.use-case';
import {
  GetExampleUseCase,
  GetGrammarTopicUseCase,
  GetSectionUseCase,
  GRAMMAR_TOPICS,
  GrammarAccess,
  ListExamplesUseCase,
  ListSectionsUseCase,
} from './application/use-cases/list-sections.use-case';
import { RemoveExampleUseCase } from './application/use-cases/remove-example.use-case';
import { RemoveSectionUseCase } from './application/use-cases/remove-section.use-case';
import { UpdateExampleUseCase } from './application/use-cases/update-example.use-case';
import { UpdateSectionUseCase } from './application/use-cases/update-section.use-case';
import { GrammarExample } from './domain/entities/grammar-example.entity';
import { GrammarSection } from './domain/entities/grammar-section.entity';
import { GrammarTopic } from './domain/entities/grammar-topic.entity';
import { GRAMMAR_DRAFT } from './domain/interfaces/grammar-draft.interface';
import { GrammarDraftClient } from './infrastructure/ai/grammar-draft-client.adapter';
import { GrammarTopicSeeder } from './infrastructure/seeds/grammar-topics.seed';
import { GrammarExamplesController } from './presentation/grammar-examples.controller';
import { GrammarSectionsController } from './presentation/grammar-sections.controller';
import { GrammarTopicsController } from './presentation/grammar-topics.controller';
// [GrammarModule · Sprints 10.9/10.10 · RF-133 a RF-135]: fichas de gramática con secciones (uso, fórmula, negativa, interrogativa, nota y errores comunes) y ejemplos con IPA UK/US y traducción; borrador con IA revisado por el docente | [Patrón]: Module + DI Container + Ports & Adapters (LANGUAGE_TOOLS de Vocabulary, GRAMMAR_DRAFT → OllamaClient de AIModule @Global) + Generic Service (TopicCrudService) | [Principio]: DIP + SRP + DRY

@Module({
  imports: [
    TypeOrmModule.forFeature([GrammarTopic, GrammarSection, GrammarExample]),
    VocabularyModule, // LANGUAGE_TOOLS: IPA y traducción de los ejemplos
  ],
  controllers: [
    GrammarTopicsController,
    GrammarSectionsController,
    GrammarExamplesController,
  ],
  providers: [
    {
      provide: GRAMMAR_TOPICS,
      inject: [getRepositoryToken(GrammarTopic)],
      useFactory: (repo: Repository<GrammarTopic>) =>
        new TopicCrudService(repo, 'Ficha'),
    },
    { provide: GRAMMAR_DRAFT, useClass: GrammarDraftClient },
    GrammarAccess,
    GetGrammarTopicUseCase,
    ListSectionsUseCase,
    GetSectionUseCase,
    ListExamplesUseCase,
    GetExampleUseCase,
    AddSectionUseCase,
    UpdateSectionUseCase,
    RemoveSectionUseCase,
    EnrichExampleUseCase,
    AddExampleUseCase,
    UpdateExampleUseCase,
    RemoveExampleUseCase,
    GenerateTopicDraftUseCase,
    GrammarTopicSeeder,
  ],
})
export class GrammarModule {}
