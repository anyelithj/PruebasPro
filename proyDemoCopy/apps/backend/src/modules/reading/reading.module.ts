import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { CreateReadingTextUseCase } from './application/use-cases/create-reading-text.use-case';
import { DraftReadingUseCase } from './application/use-cases/draft-reading.use-case';
import { EnrichReadingTextUseCase } from './application/use-cases/enrich-reading-text.use-case';
import { ExportReadingTextUseCase } from './application/use-cases/export-reading-text.use-case';
import { GetReadingTextUseCase } from './application/use-cases/get-reading-text.use-case';
import { ListReadingTextsUseCase } from './application/use-cases/list-reading-texts.use-case';
import { ReadingAccess } from './application/use-cases/reading-access';
import { ReadingContentWriter } from './application/use-cases/reading-content.writer';
import { SaveReadingProgressUseCase } from './application/use-cases/reading-progress.use-case';
import { SentenceEnricher } from './application/use-cases/sentence-enricher';
import { UpdateReadingTextUseCase } from './application/use-cases/update-reading-text.use-case';
import { UpdateSentenceUseCase } from './application/use-cases/update-sentence.use-case';
import { WithdrawReadingTextUseCase } from './application/use-cases/withdraw-reading-text.use-case';
import { ReadingProgress } from './domain/entities/reading-progress.entity';
import { ReadingSentence } from './domain/entities/reading-sentence.entity';
import { ReadingText } from './domain/entities/reading-text.entity';
import { READING_DRAFT } from './domain/interfaces/reading-draft.interface';
import { ReadingDraftClient } from './infrastructure/ai/reading-draft-client.adapter';
import { ReadingTextsController } from './presentation/reading-texts.controller';
// [ReadingModule · Lectura · 2026-10-25]: textos de lectura por género, idioma y nivel (IA, a mano o importados) con frases traducidas, IPA, marcador del estudiante y descarga PDF/TXT | [Patrón]: Module + DI Container + Ports & Adapters (READING_DRAFT → OllamaClient del AIModule @Global · LANGUAGE_TOOLS de Vocabulary → FastAPI) | [Principio]: DIP + SRP + DRY (reutiliza el puerto de traducción/IPA y renderPdf)
// [Audio]: no hay endpoint propio — el lector pide cada frase a GET /audio (Cache-Aside del AudioModule, espeak-ng) o usa la voz del navegador

@Module({
  imports: [
    TypeOrmModule.forFeature([ReadingText, ReadingSentence, ReadingProgress]),
    VocabularyModule, // LANGUAGE_TOOLS: traducción e IPA por lotes (/language-tools/lines)
  ],
  controllers: [ReadingTextsController],
  providers: [
    { provide: READING_DRAFT, useClass: ReadingDraftClient },
    ReadingAccess,
    SentenceEnricher,
    ReadingContentWriter,
    DraftReadingUseCase,
    CreateReadingTextUseCase,
    ListReadingTextsUseCase,
    GetReadingTextUseCase,
    UpdateReadingTextUseCase,
    UpdateSentenceUseCase,
    EnrichReadingTextUseCase,
    WithdrawReadingTextUseCase,
    SaveReadingProgressUseCase,
    ExportReadingTextUseCase,
  ],
})
export class ReadingModule {}
