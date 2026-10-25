import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { BroadcastEventUseCase } from '../../../notifications/application/use-cases/broadcast-event.use-case';
import { PublishNotificationUseCase } from '../../../notifications/application/use-cases/publish-notification.use-case';
import { ReportDataQuery } from '../../application/queries/report-data.query';
import { REPORTS_STORE } from '../../application/use-cases/download-report-export.use-case';
import {
  REPORT_EXPORT_QUEUE,
  type ReportExportJob,
} from '../../application/use-cases/request-report-export.use-case';
import {
  ReportExport,
  type ReportStatus,
} from '../../domain/entities/report-export.entity';
import {
  REPORT_RENDERERS,
  type ReportRenderer,
} from '../../domain/report-data';
// [Worker ReportExport · Sprint 6.4]: genera el archivo fuera del ciclo HTTP, lo guarda en el almacén de objetos y avisa al usuario en tiempo real | [Patrón]: Consumer (cola Bull) + Strategy (renderizador por formato) | [Principio]: SRP + OCP | [Paradigma]: Asíncrono + Event-Driven

@Processor(REPORT_EXPORT_QUEUE)
export class ReportExportProcessor {
  private readonly logger = new Logger(ReportExportProcessor.name);

  constructor(
    @InjectRepository(ReportExport)
    private readonly repo: Repository<ReportExport>,
    @Inject(REPORT_RENDERERS) private readonly renderers: ReportRenderer[],
    @Inject(REPORTS_STORE) private readonly store: ObjectStore,
    private readonly data: ReportDataQuery,
    private readonly notify: PublishNotificationUseCase,
    private readonly broadcast: BroadcastEventUseCase,
  ) {}

  // [setStatus]: guarda el estado y lo emite en vivo (evento efímero `report-export` → GET /events) | [Principio]: DRY (un solo punto de transición)
  private async setStatus(
    row: ReportExport,
    status: ReportStatus,
    extra: Partial<ReportExport> = {},
  ): Promise<void> {
    await this.repo.update(row.id, { status, ...extra });
    this.broadcast.execute({
      userId: row.userId,
      type: 'report-export',
      data: { id: row.id, status, sizeBytes: extra.sizeBytes ?? null },
    });
  }

  // `@Process()` (Bull): un trabajo a la vez por instancia (concurrencia 1, suficiente para reportes)
  @Process()
  async render(job: Job<ReportExportJob>): Promise<void> {
    const row = await this.repo.findOne({ where: { id: job.data.id } });
    if (!row) return; // Borrada antes de procesarse → nada que hacer
    const renderer = this.renderers.find((r) => r.format === row.format);
    try {
      if (!renderer) throw new Error(`Formato sin renderizador: ${row.format}`);
      await this.setStatus(row, 'processing');
      const file = await renderer.render(
        await this.data.execute(row.periodMonths),
      );
      const objectKey = `${row.userId}/${row.id}.${renderer.extension}`; // Carpeta por usuario en el bucket
      await this.store.put(objectKey, file, renderer.contentType);
      await this.setStatus(row, 'ready', {
        objectKey,
        sizeBytes: file.length,
        completedAt: new Date(),
        error: null,
      });
      await this.notify.execute({
        userId: row.userId,
        title: `Tu reporte ${row.format.toUpperCase()} está listo`,
        body: 'Descárgalo desde Reportes.',
        href: '/admin/reports',
        payload: { reportExportId: row.id },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1); // ¿Era el último intento?
      await this.setStatus(row, last ? 'failed' : 'pending', {
        error: message.slice(0, 1000),
      });
      if (last)
        await this.notify.execute({
          userId: row.userId,
          title: 'No se pudo generar tu reporte',
          body: message.slice(0, 300),
          href: '/admin/reports',
        });
      this.logger.warn(
        `Reporte ${row.id} falló (intento ${job.attemptsMade + 1}): ${message}`,
      );
      throw err; // Bull reintenta según `attempts`
    }
  }
}
