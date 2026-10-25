import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import jwtConfig from '../../shared/config/jwt.config';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { ResourceCreatedListener } from './application/listeners/resource-created.listener';
import { CreateVocabularyEntryUseCase } from './application/use-cases/create-vocabulary-entry.use-case';
import { DeleteVocabularyEntryUseCase } from './application/use-cases/delete-vocabulary-entry.use-case';
import {
  GetVocabularyEntryUseCase,
  ListMyVocabularyUseCase,
} from './application/use-cases/list-my-vocabulary.use-case';
import {
  GetLookupUseCase,
  LookupTermUseCase,
} from './application/use-cases/lookup-term.use-case';
import { LookupWordUseCase } from './application/use-cases/lookup-word.use-case';
import {
  GetMarkedWordUseCase,
  ListMarkedWordsUseCase,
} from './application/use-cases/list-marked-words.use-case';
import { MarkWordLearnedUseCase } from './application/use-cases/mark-word-learned.use-case';
import { MarkWordLearningUseCase } from './application/use-cases/mark-word-learning.use-case';
import { UnmarkWordUseCase } from './application/use-cases/unmark-word.use-case';
import { PurgeLookupCacheUseCase } from './application/use-cases/purge-lookup-cache.use-case';
import { UpdateVocabularyEntryUseCase } from './application/use-cases/update-vocabulary-entry.use-case';
import { LanguageLookup } from './domain/entities/language-lookup.entity';
import { VocabularyEntry } from './domain/entities/vocabulary-entry.entity';
import { LANGUAGE_TOOLS } from '../../shared/domain/interfaces/language-tools.interface';
import { LanguageToolsClient } from './infrastructure/ai/language-tools-client.adapter';
import { TopicTitleUseCase } from './application/use-cases/topic-title.use-case';
import { LanguageLookupController } from './presentation/language-lookup.controller';
import { VocabularyController } from './presentation/vocabulary.controller';
import { WordLookupController } from './presentation/word-lookup.controller';
import { WordStatusController } from './presentation/word-status.controller';
// [VocabularyModule · Sprint 8.2 · RF-106 a RF-109, RF-136]: banco de vocabulario + traducción e IPA UK/US con caché (LanguageLookup) + precálculo al publicar recursos | [Patrón]: Module + DI Container + Ports & Adapters (LANGUAGE_TOOLS → LanguageToolsClient) | [Principio]: DIP + SRP + DRY (Games reutiliza VocabularyEntry por export)

@Module({
  imports: [
    TypeOrmModule.forFeature([VocabularyEntry, LanguageLookup]),
    HttpModule,
    CurriculumModule, // CURRICULUM_REPOSITORY: leer el recurso publicado (listener)
    JwtModule.register({}), // Token de servicio de 2 min para el listener
    ConfigModule.forFeature(jwtConfig),
  ],
  // [Orden]: rutas más específicas primero (/vocabulary/lookup/word y /vocabulary/words antes que /vocabulary/lookup y /vocabulary/:id)
  controllers: [
    WordLookupController,
    WordStatusController,
    LanguageLookupController,
    VocabularyController,
  ],
  providers: [
    { provide: LANGUAGE_TOOLS, useClass: LanguageToolsClient },
    LookupTermUseCase,
    GetLookupUseCase,
    TopicTitleUseCase, // [2026-10-19]
    LookupWordUseCase,
    PurgeLookupCacheUseCase,
    CreateVocabularyEntryUseCase,
    ListMyVocabularyUseCase,
    GetVocabularyEntryUseCase,
    UpdateVocabularyEntryUseCase,
    DeleteVocabularyEntryUseCase,
    ResourceCreatedListener,
    // [Sprint 10.2 · RF-137]: «Aprender» / «Aprendido» del diccionario
    MarkWordLearningUseCase,
    ListMarkedWordsUseCase,
    GetMarkedWordUseCase,
    MarkWordLearnedUseCase,
    UnmarkWordUseCase,
  ],
  // Games lee VocabularyEntry para el mazo de flashcards (sin otra tabla) · [Sprint 9.1]: Music y Dialogues reutilizan el mismo cliente de LanguageTools
  exports: [TypeOrmModule, LANGUAGE_TOOLS],
})
export class VocabularyModule {}
