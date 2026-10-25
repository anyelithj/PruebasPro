import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bull';
import {
  MAINTENANCE_JOBS,
  MAINTENANCE_QUEUE,
  type MaintenanceJobName,
} from '../../application/use-cases/list-jobs.use-case';
import { PurgeExpiredSessionsUseCase } from '../../application/use-cases/purge-expired-sessions.use-case';
// [Worker Maintenance · Sprint 7.18 · RF-81]: registra los trabajos repetibles (cron de Bull) al arrancar y los ejecuta | [Patrón]: Consumer (cola Bull) + Scheduler (repeat.cron) | [Principio]: SRP + idempotencia (Bull identifica el repetible por nombre + cron → reiniciar no lo duplica) | [Paradigma]: Asíncrono
// [Por qué Bull y no @nestjs/schedule]: con varias instancias del backend, Redis garantiza que el cron corre UNA vez (un @Cron correría en cada instancia)

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
    private readonly purge: PurgeExpiredSessionsUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const [name, { cron }] of Object.entries(MAINTENANCE_JOBS) as [
      MaintenanceJobName,
      { cron: string },
    ][]) {
      await this.queue
        .add(
          name,
          {},
          { repeat: { cron }, removeOnComplete: 50, removeOnFail: 50 },
        )
        .catch((err: unknown) =>
          this.logger.warn(
            `Cron ${name} sin registrar (¿Redis caído?): ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }
  }

  // `@Process(nombre)` (Bull): el valor devuelto queda en job.returnvalue → el panel muestra cuántas filas se purgaron
  @Process('purge-expired-sessions')
  purgeExpiredSessions(): Promise<Record<string, number>> {
    return this.purge.execute();
  }
}
