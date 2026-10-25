import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AulaEventsService } from '@core/events/aula-events.service';
import { AsyncState } from '@shared/utils/async-state';
import { ReportsRepository } from '../domain/reports.repository.port';
import { applyProgress, type ReportExport, type ReportFormat } from '../domain/models/reports';
// [ReportsFacade · Aplicación]: casos de uso solicitar, listar, descargar, borrar + progreso en vivo | [Patrón]: Facade + State Machine + Observer (SSE) | [Principio]: SRP + DIP | [Paradigma]: Reactivo
// [Integración]: al pedir una exportación publica `aula:report-requested` → el shell de Next.js puede reaccionar sin acoplarse a Angular

@Injectable()
export class ReportsFacade {
  private readonly repo = inject(ReportsRepository);
  private readonly events = inject(AulaEventsService);

  readonly exports = new AsyncState<ReportExport[]>((rows) => rows.length === 0);
  readonly requesting = signal(false);
  readonly lastRequested = signal<ReportExport | null>(null);
  readonly actionError = signal<string | null>(null);

  load(): Promise<ReportExport[] | null> {
    return this.exports.run(this.repo.mine());
  }

  // [connect]: progreso en vivo mientras viva quien lo pide | `takeUntilDestroyed` (Angular) cierra el SSE
  connect(destroyRef: DestroyRef): void {
    this.repo
      .progress()
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (p) => {
          const rows = this.exports.data();
          if (rows) this.exports.set(applyProgress(rows, p));
        },
        error: () => undefined, // EventSource reintenta solo
      });
  }

  async request(format: ReportFormat, periodMonths: number | null): Promise<ReportExport | null> {
    this.requesting.set(true);
    this.actionError.set(null);
    try {
      const row = await firstValueFrom(this.repo.request(format, periodMonths));
      this.exports.set([row, ...(this.exports.data() ?? [])]);
      this.lastRequested.set(row);
      this.events.publish('report-requested', { id: row.id, format });
      return row;
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.requesting.set(false);
    }
  }

  async remove(id: string): Promise<void> {
    this.actionError.set(null);
    try {
      await firstValueFrom(this.repo.remove(id));
      this.exports.set((this.exports.data() ?? []).filter((r) => r.id !== id)); // Se quita solo si el backend confirma
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
    }
  }

  downloadUrl(id: string): string {
    return this.repo.downloadUrl(id);
  }
}
