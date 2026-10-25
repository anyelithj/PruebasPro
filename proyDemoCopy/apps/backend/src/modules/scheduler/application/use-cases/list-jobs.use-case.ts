import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Job, JobCounts, Queue } from 'bull';
import { EMAIL_QUEUE } from '../../../notifications/application/use-cases/enqueue-email.use-case';
import { REPORT_EXPORT_QUEUE } from '../../../reports/application/use-cases/request-report-export.use-case';
import { CERTIFICATE_ANCHOR_QUEUE } from '../../../web3/application/use-cases/anchor-certificate-hash.use-case';
import { CRYPTO_PAYMENT_QUEUE } from '../../../web3/application/use-cases/register-crypto-tx.use-case';
// [UseCases ListJobs + GetJob · Sprint 7.18 · RF-81]: estado de TODAS las colas Bull y de los trabajos programados (panel ADMIN) | [Patrón]: Query (CQRS ligero) + Registry (MAINTENANCE_JOBS) | [Principio]: SRP + SSOT (nombres de cola importados de sus dueños) | [Paradigma]: POO + async/await

export const MAINTENANCE_QUEUE = 'maintenance';
// [Registro de trabajos programados]: nombre → cron + descripción | [Principio]: OCP (trabajo nuevo = una entrada + su @Process)
export const MAINTENANCE_JOBS = {
  'purge-expired-sessions': {
    cron: '0 3 * * *',
    description:
      'Purga sesiones, tokens de un solo uso caducados y correos enviados antiguos (03:00)',
  },
} as const;
export type MaintenanceJobName = keyof typeof MAINTENANCE_JOBS;
export const OBSERVED_QUEUES = [
  MAINTENANCE_QUEUE,
  EMAIL_QUEUE,
  REPORT_EXPORT_QUEUE,
  CRYPTO_PAYMENT_QUEUE,
  CERTIFICATE_ANCHOR_QUEUE,
] as const;

export interface JobView {
  id: string;
  name: string;
  status: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed';
  finishedOn: number | null;
  result: unknown;
  failedReason: string | null;
}

const view = (j: Job, status: JobView['status']): JobView => ({
  id: String(j.id),
  name: j.name,
  status,
  finishedOn: j.finishedOn ?? null,
  result: j.returnvalue ?? null,
  failedReason: j.failedReason ?? null,
});

@Injectable()
export class ListJobsUseCase {
  private readonly queues: Queue[];

  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly maintenance: Queue,
    @InjectQueue(EMAIL_QUEUE) email: Queue,
    @InjectQueue(REPORT_EXPORT_QUEUE) reports: Queue,
    @InjectQueue(CRYPTO_PAYMENT_QUEUE) crypto: Queue,
    @InjectQueue(CERTIFICATE_ANCHOR_QUEUE) anchor: Queue,
  ) {
    this.queues = [maintenance, email, reports, crypto, anchor];
  }

  async execute(): Promise<{
    queues: { name: string; counts: JobCounts }[];
    scheduled: {
      name: string;
      cron: string;
      description: string;
      next: number | null;
    }[];
    recent: JobView[];
  }> {
    const [queues, repeatable, completed, failed] = await Promise.all([
      Promise.all(
        this.queues.map(async (q) => ({
          name: q.name,
          counts: await q.getJobCounts(),
        })),
      ),
      this.maintenance.getRepeatableJobs(),
      this.maintenance.getCompleted(0, 9),
      this.maintenance.getFailed(0, 9),
    ]);
    const scheduled = (
      Object.keys(MAINTENANCE_JOBS) as MaintenanceJobName[]
    ).map((name) => ({
      name,
      ...MAINTENANCE_JOBS[name],
      next: repeatable.find((r) => r.name === name)?.next ?? null, // null = aún no registrado en Redis
    }));
    const recent = [
      ...completed.map((j) => view(j, 'completed')),
      ...failed.map((j) => view(j, 'failed')),
    ].sort((a, b) => (b.finishedOn ?? 0) - (a.finishedOn ?? 0));
    return { queues, scheduled, recent };
  }
}

@Injectable()
export class GetJobUseCase {
  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly maintenance: Queue,
  ) {}

  async execute(id: string): Promise<JobView> {
    const job = await this.maintenance.getJob(id);
    if (!job)
      throw new NotFoundException(
        'Trabajo no encontrado (los terminados se conservan pocos días)',
      );
    const state = await job.getState();
    return view(
      job,
      (['completed', 'failed', 'active', 'delayed'] as const).find(
        (s) => s === state,
      ) ?? 'waiting',
    );
  }
}
