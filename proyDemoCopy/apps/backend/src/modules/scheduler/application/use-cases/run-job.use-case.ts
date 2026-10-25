import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bull';
import { MAINTENANCE_JOBS, MAINTENANCE_QUEUE } from './list-jobs.use-case';
// [UseCase RunJob · Sprint 7.18]: el ADMIN ejecuta YA un trabajo programado (sin esperar a su cron) | [Patrón]: Command + Producer (misma cola y mismo worker que el cron) | [Principio]: SRP + DRY (no hay un segundo camino de ejecución) + Fail Fast (solo nombres registrados) | [Paradigma]: POO + async/await

@Injectable()
export class RunJobUseCase {
  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly maintenance: Queue,
  ) {}

  async execute(name: string): Promise<{ jobId: string }> {
    if (!(name in MAINTENANCE_JOBS))
      throw new NotFoundException(`Trabajo desconocido: ${name}`);
    const job = await this.maintenance.add(
      name,
      {},
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: String(job.id) };
  }
}
