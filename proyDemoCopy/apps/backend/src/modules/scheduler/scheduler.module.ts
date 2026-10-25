import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import {
  GetJobUseCase,
  ListJobsUseCase,
  OBSERVED_QUEUES,
} from './application/use-cases/list-jobs.use-case';
import { PurgeExpiredSessionsUseCase } from './application/use-cases/purge-expired-sessions.use-case';
import { RunJobUseCase } from './application/use-cases/run-job.use-case';
import { MaintenanceProcessor } from './infrastructure/queue/maintenance.processor';
import { ScheduledJobsController } from './presentation/scheduled-jobs.controller';
// [SchedulerModule · Sprint 7.18 · RF-81]: tareas programadas con trabajos repetibles de Bull + panel ADMIN de colas | [Patrón]: Module + DI Container | [Principio]: SRP + DRY (mismo Redis y misma librería de colas que el resto del backend)
// [Colas observadas]: se registran aquí solo para LEERLAS (contadores); sus workers siguen en sus módulos

@Module({
  imports: [
    BullModule.registerQueue(...OBSERVED_QUEUES.map((name) => ({ name }))),
  ],
  controllers: [ScheduledJobsController],
  providers: [
    ListJobsUseCase,
    GetJobUseCase,
    RunJobUseCase,
    PurgeExpiredSessionsUseCase,
    MaintenanceProcessor,
  ],
})
export class SchedulerModule {}
