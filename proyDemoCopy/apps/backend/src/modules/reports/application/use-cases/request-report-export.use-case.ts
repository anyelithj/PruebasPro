import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import {
  ReportExport,
  type ReportFormat,
} from '../../domain/entities/report-export.entity';
// [Caso de uso RequestReportExport · Sprint 6.4]: registra la petición y la encola → responde al instante (202) y el worker genera el archivo | [Patrón]: Command + Producer/Consumer (cola Bull) | [Principio]: SRP | [Paradigma]: Asíncrono
// [Tecnología]: @nestjs/bull + Redis

export const REPORT_EXPORT_QUEUE = 'report-export'; // [SSOT]: nombre de la cola (lo comparten productor y worker)

export interface ReportExportJob {
  id: string; // Solo el id: el worker relee la fila (la cola no guarda datos que puedan quedar obsoletos)
}

@Injectable()
export class RequestReportExportUseCase {
  constructor(
    @InjectRepository(ReportExport)
    private readonly repo: Repository<ReportExport>,
    @InjectQueue(REPORT_EXPORT_QUEUE)
    private readonly queue: Queue<ReportExportJob>,
  ) {}

  async execute(
    userId: string,
    format: ReportFormat,
    periodMonths: number | null,
  ): Promise<ReportExport> {
    const row = await this.repo.save(
      this.repo.create({ userId, format, periodMonths, status: 'pending' }),
    );
    // `attempts` + `backoff` (Bull): reintenta 2 veces si falla (p. ej. el almacén S3 caído un momento) | `removeOnComplete`: Redis no acumula trabajos
    await this.queue.add(
      { id: row.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    );
    return row;
  }
}
