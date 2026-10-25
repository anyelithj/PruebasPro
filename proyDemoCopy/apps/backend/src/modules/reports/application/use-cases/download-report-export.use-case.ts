import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RangedSource } from '../../../../shared/http/ranged-response';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { ReportExport } from '../../domain/entities/report-export.entity';
import {
  REPORT_RENDERERS,
  type ReportRenderer,
} from '../../domain/report-data';
// [Casos de uso de lectura y borrado de exportaciones · Sprint 6.4]: mis exportaciones, descargar y eliminar | [Patrón]: Query + Command (CQRS ligero) | [Principio]: SRP + DIP | [Paradigma]: POO + async/await
// [Seguridad]: todas filtran por userId → nadie ve ni descarga archivos ajenos (404, no 403: no se revela que existen)

export const REPORTS_STORE = Symbol('REPORTS_STORE'); // Token del ObjectStore de reportes (prefijo «reports»)

// [findOwned]: fila del usuario o 404 | [Principio]: DRY (lo usan descargar y borrar)
async function findOwned(
  repo: Repository<ReportExport>,
  userId: string,
  id: string,
): Promise<ReportExport> {
  const row = await repo.findOne({ where: { id, userId } });
  if (!row) throw new NotFoundException('Exportación no encontrada');
  return row;
}

@Injectable()
export class ListMyExportsUseCase {
  constructor(
    @InjectRepository(ReportExport)
    private readonly repo: Repository<ReportExport>,
  ) {}

  execute(userId: string): Promise<ReportExport[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}

@Injectable()
export class DownloadReportExportUseCase {
  constructor(
    @InjectRepository(ReportExport)
    private readonly repo: Repository<ReportExport>,
    @Inject(REPORTS_STORE) private readonly store: ObjectStore,
    @Inject(REPORT_RENDERERS) private readonly renderers: ReportRenderer[],
  ) {}

  // Devuelve el nombre de descarga + la fuente por rangos; el tipo MIME lo define el renderizador del formato (SSOT)
  async execute(
    userId: string,
    id: string,
  ): Promise<{ filename: string; source: RangedSource }> {
    const row = await findOwned(this.repo, userId, id);
    const renderer = this.renderers.find((r) => r.format === row.format);
    if (
      row.status !== 'ready' ||
      !row.objectKey ||
      row.sizeBytes === null ||
      !renderer
    )
      throw new ConflictException('El reporte todavía no está listo'); // 409: existe pero aún no se puede descargar
    const key = row.objectKey;
    const filename = `reporte-${row.createdAt.toISOString().slice(0, 10)}.${renderer.extension}`;
    return {
      filename,
      source: {
        size: row.sizeBytes,
        contentType: renderer.contentType,
        open: (range) => this.store.open(key, range),
        // [Sprint 6.7]: con S3/R2 la descarga sale directo del bucket (URL firmada corta); null en disco → streaming
        signedUrl: await this.store.signedUrl(key, {
          filename,
          contentType: renderer.contentType,
          disposition: 'attachment',
        }),
      },
    };
  }
}

@Injectable()
export class DeleteReportExportUseCase {
  constructor(
    @InjectRepository(ReportExport)
    private readonly repo: Repository<ReportExport>,
    @Inject(REPORTS_STORE) private readonly store: ObjectStore,
  ) {}

  async execute(userId: string, id: string): Promise<{ deleted: true }> {
    const row = await findOwned(this.repo, userId, id);
    if (row.objectKey) await this.store.remove(row.objectKey); // Binario primero: si falla, la fila queda y se puede reintentar
    await this.repo.delete(row.id);
    return { deleted: true };
  }
}
