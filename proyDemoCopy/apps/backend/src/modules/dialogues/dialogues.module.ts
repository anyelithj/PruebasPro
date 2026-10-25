import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TopicCrudService } from '../../shared/application/topic-crud.service';
import { createObjectStore } from '../../shared/storage/object-store';
import { MusicModule } from '../music/music.module';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { AddTurnUseCase } from './application/use-cases/add-turn.use-case';
import { TurnEnricher } from './application/use-cases/turn-enricher';
import { ClassifyDialogueLevelUseCase } from './application/use-cases/classify-dialogue-level.use-case';
import { ConfirmDialogueLevelUseCase } from './application/use-cases/confirm-dialogue-level.use-case';
import { DeleteDialogueSessionUseCase } from './application/use-cases/delete-dialogue-session.use-case';
import { EndDialogueSessionUseCase } from './application/use-cases/end-dialogue-session.use-case';
import {
  DIALOGUES_STORE,
  DialogueAccess,
  GetDialogueUseCase,
} from './application/use-cases/get-dialogue.use-case';
import {
  GetDialogueSessionUseCase,
  OwnedDialogueSession,
} from './application/use-cases/get-dialogue-session.use-case';
import { ListDialogueSessionsUseCase } from './application/use-cases/list-dialogue-sessions.use-case';
import { ListDialoguesUseCase } from './application/use-cases/list-dialogues.use-case';
import {
  GetTurnUseCase,
  ListTurnsUseCase,
} from './application/use-cases/list-turns.use-case';
import { RemoveTurnUseCase } from './application/use-cases/remove-turn.use-case';
import {
  DIALOGUE_TOPICS,
  StartDialogueSessionUseCase,
} from './application/use-cases/start-dialogue-session.use-case';
import { SubmitUserTurnUseCase } from './application/use-cases/submit-user-turn.use-case';
import { TurnRecordingUseCase } from './application/use-cases/turn-recording.use-case';
import { UpdateTurnUseCase } from './application/use-cases/update-turn.use-case';
import { UploadDialogueUseCase } from './application/use-cases/upload-dialogue.use-case';
import { WithdrawDialogueUseCase } from './application/use-cases/withdraw-dialogue.use-case';
import { DraftDialogueUseCase } from './application/use-cases/draft-dialogue.use-case';
import { Dialogue } from './domain/entities/dialogue.entity';
import { DialogueSession } from './domain/entities/dialogue-session.entity';
import { DialogueTopic } from './domain/entities/dialogue-topic.entity';
import { DialogueTurn } from './domain/entities/dialogue-turn.entity';
import { DIALOGUE_AGENT } from './domain/interfaces/dialogue-agent.interface';
import { LEVEL_CLASSIFIER } from './domain/interfaces/level-classifier.interface';
import { DialogueAgentClient } from './infrastructure/ai/dialogue-agent-client.adapter';
import { LevelClassifierClient } from './infrastructure/ai/level-classifier-client.adapter';
import { DialogueTopicSeeder } from './infrastructure/seeds/dialogue-topics.seed';
import { DialogueSessionsController } from './presentation/dialogue-sessions.controller';
import { DialogueTopicsController } from './presentation/dialogue-topics.controller';
import { DialogueTurnsController } from './presentation/dialogue-turns.controller';
import { DialoguesController } from './presentation/dialogues.controller';
// [DialoguesModule · Sprints 9.3/9.12/9.13 · RF-121 a RF-128]: temas, biblioteca de diálogos guionados con nivel estimado y confirmado, turnos con IPA y traducción y conversación con el avatar | [Patrón]: Module + DI Container + Ports & Adapters (LANGUAGE_TOOLS de Vocabulary, ALIGNMENT de Music, LEVEL_CLASSIFIER y DIALOGUE_AGENT hacia FastAPI) + Generic Service (TopicCrudService) | [Principio]: DIP + SRP + DRY

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DialogueTopic,
      Dialogue,
      DialogueTurn,
      DialogueSession,
    ]),
    HttpModule,
    VocabularyModule, // LANGUAGE_TOOLS: traducción e IPA por turno
    MusicModule, // ALIGNMENT: tiempos de los turnos con audio (mismo cliente que las canciones)
  ],
  // [Orden]: «topics» y «sessions» antes que «:id» (si no, /dialogues/topics caería en GET /dialogues/:id)
  controllers: [
    DialogueTopicsController,
    DialogueSessionsController,
    DialogueTurnsController,
    DialoguesController,
  ],
  providers: [
    {
      provide: DIALOGUE_TOPICS,
      inject: [getRepositoryToken(DialogueTopic)],
      useFactory: (repo: Repository<DialogueTopic>) =>
        new TopicCrudService(repo, 'Tema'),
    },
    {
      provide: DIALOGUES_STORE,
      useFactory: () => createObjectStore('dialogues'),
    },
    { provide: LEVEL_CLASSIFIER, useClass: LevelClassifierClient },
    { provide: DIALOGUE_AGENT, useClass: DialogueAgentClient },
    DialogueAccess,
    TurnEnricher,
    ClassifyDialogueLevelUseCase,
    UploadDialogueUseCase,
    DraftDialogueUseCase, // [2026-10-19]: borradores desde URL o IA (OllamaClient del AIModule @Global)
    ListDialoguesUseCase,
    GetDialogueUseCase,
    ConfirmDialogueLevelUseCase,
    WithdrawDialogueUseCase,
    AddTurnUseCase,
    ListTurnsUseCase,
    GetTurnUseCase,
    UpdateTurnUseCase,
    RemoveTurnUseCase,
    OwnedDialogueSession,
    StartDialogueSessionUseCase,
    ListDialogueSessionsUseCase,
    GetDialogueSessionUseCase,
    SubmitUserTurnUseCase,
    TurnRecordingUseCase, // [2026-10-20]: grabación de voz de cada turno del usuario
    EndDialogueSessionUseCase,
    DeleteDialogueSessionUseCase,
    DialogueTopicSeeder,
  ],
})
export class DialoguesModule {}
