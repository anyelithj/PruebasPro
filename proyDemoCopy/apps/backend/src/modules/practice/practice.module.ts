import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddItemUseCase } from './application/use-cases/add-item.use-case';
import { ArchiveActivityUseCase } from './application/use-cases/archive-activity.use-case';
import { ClearMyAttemptsUseCase } from './application/use-cases/clear-my-attempts.use-case';
import { CreateActivityUseCase } from './application/use-cases/create-activity.use-case';
import { GenerateActivityDraftUseCase } from './application/use-cases/generate-activity-draft.use-case';
import {
  ActivityAccess,
  GetActivityUseCase,
} from './application/use-cases/get-activity.use-case';
import { ListActivitiesUseCase } from './application/use-cases/list-activities.use-case';
import {
  GetItemUseCase,
  ListItemsUseCase,
} from './application/use-cases/list-items.use-case';
import { ListMyAttemptsUseCase } from './application/use-cases/list-my-attempts.use-case';
import { GetAttemptUseCase } from './application/use-cases/get-attempt.use-case';
import { RemoveItemUseCase } from './application/use-cases/remove-item.use-case';
import { SubmitAttemptUseCase } from './application/use-cases/submit-attempt.use-case';
import { UpdateActivityUseCase } from './application/use-cases/update-activity.use-case';
import { UpdateItemUseCase } from './application/use-cases/update-item.use-case';
import { PracticeActivity } from './domain/entities/practice-activity.entity';
import { PracticeAttempt } from './domain/entities/practice-attempt.entity';
import { PracticeItem } from './domain/entities/practice-item.entity';
import { PRACTICE_EVALUATOR } from './domain/interfaces/practice-evaluator.interface';
import { PracticeFeedbackClient } from './infrastructure/ai/practice-feedback-client.adapter';
import { PracticeActivitiesController } from './presentation/practice-activities.controller';
import { PracticeAttemptsController } from './presentation/practice-attempts.controller';
import { PracticeItemsController } from './presentation/practice-items.controller';
// [PracticeModule · Sprint 8.12 · RF-110 a RF-114]: actividades, ítems e intentos con retroalimentación inmediata (FastAPI Grading) y borradores con IA (OllamaClient compartido de AIModule, @Global) | [Patrón]: Module + DI Container + Ports & Adapters (PRACTICE_EVALUATOR → PracticeFeedbackClient) + Domain Event (PracticeAttempted → Score) | [Principio]: DIP + SRP

@Module({
  imports: [
    TypeOrmModule.forFeature([PracticeActivity, PracticeItem, PracticeAttempt]),
    HttpModule,
  ],
  controllers: [
    PracticeAttemptsController,
    PracticeItemsController,
    PracticeActivitiesController,
  ],
  exports: [CreateActivityUseCase], // [Sprint 9.10]: Music genera prácticas de canciones con el mismo caso de uso (DRY)
  providers: [
    { provide: PRACTICE_EVALUATOR, useClass: PracticeFeedbackClient },
    ActivityAccess,
    CreateActivityUseCase,
    GenerateActivityDraftUseCase,
    ListActivitiesUseCase,
    GetActivityUseCase,
    UpdateActivityUseCase,
    ArchiveActivityUseCase,
    AddItemUseCase,
    ListItemsUseCase,
    GetItemUseCase,
    UpdateItemUseCase,
    RemoveItemUseCase,
    SubmitAttemptUseCase,
    ListMyAttemptsUseCase,
    GetAttemptUseCase,
    ClearMyAttemptsUseCase,
  ],
})
export class PracticeModule {}
