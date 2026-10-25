import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { WordMarkedToLearnListener } from './application/listeners/word-marked-to-learn.listener';
import { AddFlashcardUseCase } from './application/use-cases/add-flashcard.use-case';
import { ArchiveScenarioUseCase } from './application/use-cases/archive-scenario.use-case';
import { CancelGameSessionUseCase } from './application/use-cases/cancel-game-session.use-case';
import { ClearMyFluencyUseCase } from './application/use-cases/clear-my-fluency.use-case';
import { CreateScenarioUseCase } from './application/use-cases/create-scenario.use-case';
import { FinishGameSessionUseCase } from './application/use-cases/finish-game-session.use-case';
import {
  GetDueFlashcardsUseCase,
  GetFlashcardUseCase,
} from './application/use-cases/get-due-flashcards.use-case';
import {
  GetFluencyProgressUseCase,
  GetSessionFluencyUseCase,
} from './application/use-cases/get-fluency-progress.use-case';
import {
  GetGameSessionUseCase,
  OwnedSession,
} from './application/use-cases/get-game-session.use-case';
import { ListMySessionsUseCase } from './application/use-cases/list-my-sessions.use-case';
import {
  GetRoundUseCase,
  ListRoundsUseCase,
} from './application/use-cases/list-rounds.use-case';
import {
  GetScenarioUseCase,
  ListScenariosUseCase,
} from './application/use-cases/list-scenarios.use-case';
import { PlayAgentTurnUseCase } from './application/use-cases/play-agent-turn.use-case';
import { RecordFluencyMetricUseCase } from './application/use-cases/record-fluency-metric.use-case';
import { RemoveFlashcardUseCase } from './application/use-cases/remove-flashcard.use-case';
import { ReviewFlashcardUseCase } from './application/use-cases/review-flashcard.use-case';
import { StartGameSessionUseCase } from './application/use-cases/start-game-session.use-case';
import { SubmitRoundUseCase } from './application/use-cases/submit-round.use-case';
import { UpdateScenarioUseCase } from './application/use-cases/update-scenario.use-case';
import { FlashcardState } from './domain/entities/flashcard-state.entity';
import { FluencyMetric } from './domain/entities/fluency-metric.entity';
import { GameRound } from './domain/entities/game-round.entity';
import { GameSession } from './domain/entities/game-session.entity';
import { RolePlayScenario } from './domain/entities/roleplay-scenario.entity';
import { GAME_AGENT, SPEECH } from './domain/interfaces/game-agent.interface';
import { GameAgentClient } from './infrastructure/ai/game-agent-client.adapter';
import { SpeechClient } from './infrastructure/ai/speech-client.adapter';
import { RolePlayScenarioSeeder } from './infrastructure/seeds/roleplay-scenarios.seed';
import { FlashcardStatesController } from './presentation/flashcard-states.controller';
import { FluencyMetricsController } from './presentation/fluency-metrics.controller';
import { GameRoundsController } from './presentation/game-rounds.controller';
import { GameSessionsController } from './presentation/game-sessions.controller';
import { GameCatalogController } from './presentation/game-catalog.controller';
import { GameCatalogUseCase } from './application/use-cases/game-catalog.use-case';
import { GameSetting } from './domain/entities/game-setting.entity';
import { RolePlayScenariosController } from './presentation/role-play-scenarios.controller';
import { SpeechController } from './presentation/speech.controller';
// [GamesModule · Sprint 8.5 · RF-98 a RF-105]: partidas, rondas, mazo SM-2, métricas de fluidez y escenarios de role-play + puertas al agente de juegos y a Speech (FastAPI) | [Patrón]: Module + DI Container + Ports & Adapters (GAME_AGENT → GameAgentClient, SPEECH → SpeechClient) + Domain Event (GameCompleted → Score) | [Principio]: DIP + SRP + DRY (VocabularyEntry por export de Vocabulary)

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameSession,
      GameRound,
      FlashcardState,
      FluencyMetric,
      RolePlayScenario,
      GameSetting, // [2026-10-24]: ajustes editables del catálogo
    ]),
    HttpModule,
    VocabularyModule, // VocabularyEntry: palabras de las partidas y del mazo
  ],
  // [Orden]: rutas específicas antes que las genéricas con :id
  controllers: [
    FlashcardStatesController,
    FluencyMetricsController,
    RolePlayScenariosController,
    GameCatalogController, // [2026-10-24]: /games/catalog (antes GET dentro de GameSessionsController)
    GameRoundsController,
    GameSessionsController,
    SpeechController,
  ],
  providers: [
    WordMarkedToLearnListener, // [Sprint 10.2]: «Aprender» del diccionario → mazo
    { provide: GAME_AGENT, useClass: GameAgentClient },
    { provide: SPEECH, useClass: SpeechClient },
    OwnedSession,
    GameCatalogUseCase,
    StartGameSessionUseCase,
    ListMySessionsUseCase,
    GetGameSessionUseCase,
    FinishGameSessionUseCase,
    CancelGameSessionUseCase,
    SubmitRoundUseCase,
    ListRoundsUseCase,
    GetRoundUseCase,
    PlayAgentTurnUseCase,
    AddFlashcardUseCase,
    GetDueFlashcardsUseCase,
    GetFlashcardUseCase,
    ReviewFlashcardUseCase,
    RemoveFlashcardUseCase,
    RecordFluencyMetricUseCase,
    GetFluencyProgressUseCase,
    GetSessionFluencyUseCase,
    ClearMyFluencyUseCase,
    CreateScenarioUseCase,
    ListScenariosUseCase,
    GetScenarioUseCase,
    UpdateScenarioUseCase,
    ArchiveScenarioUseCase,
    RolePlayScenarioSeeder,
  ],
})
export class GamesModule {}
