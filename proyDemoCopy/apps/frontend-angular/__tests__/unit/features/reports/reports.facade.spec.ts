import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AulaEventsService } from '@core/events/aula-events.service';
import { ReportsRepository } from '@features/reports/domain/reports.repository.port';
import type { ReportExport, ReportProgress } from '@features/reports/domain/models/reports';
import { ReportsFacade } from '@features/reports/application/reports.facade';
// [Spec ReportsFacade]: solicitar (fila nueva + evento aula:report-requested), progreso en vivo, borrar y errores | [Patrón]: Test Double (repositorio falso)

const row = (id: string, status: ReportExport['status'] = 'pending'): ReportExport => ({
  id,
  format: 'pdf',
  periodMonths: null,
  status,
  sizeBytes: null,
  error: null,
  createdAt: '2026-10-15T00:00:00Z',
});

function setup(overrides: Partial<ReportsRepository> = {}) {
  const progress = new Subject<ReportProgress>();
  const repo: ReportsRepository = {
    request: () => of(row('new')),
    mine: () => of([row('a')]),
    remove: () => of({}),
    downloadUrl: (id) => `/api/reports/export/${id}/download`,
    progress: () => progress,
    ...overrides,
  };
  TestBed.configureTestingModule({ providers: [ReportsFacade, { provide: ReportsRepository, useValue: repo }] });
  return { facade: TestBed.inject(ReportsFacade), progress, events: TestBed.inject(AulaEventsService) };
}

describe('ReportsFacade', () => {
  it('solicitar añade la fila arriba y publica aula:report-requested', async () => {
    const { facade, events } = setup();
    const seen: unknown[] = [];
    events.on('report-requested').subscribe((d) => seen.push(d));
    await facade.load();
    await facade.request('pdf', 6);
    expect(facade.exports.data()?.map((r) => r.id)).toEqual(['new', 'a']);
    expect(seen).toEqual([{ id: 'new', format: 'pdf' }]);
  });

  it('el progreso en vivo cambia el estado de la fila', async () => {
    const { facade, progress } = setup();
    await facade.load();
    facade.connect(TestBed.inject(DestroyRef));
    progress.next({ id: 'a', status: 'ready', sizeBytes: 2048 });
    expect(facade.exports.data()?.[0]).toMatchObject({ status: 'ready', sizeBytes: 2048 });
  });

  it('si borrar falla, la fila se queda y se muestra el error', async () => {
    const { facade } = setup({ remove: () => throwError(() => new Error('No')) });
    await facade.load();
    await facade.remove('a');
    expect(facade.exports.data()?.length).toBe(1);
    expect(facade.actionError()).toBe('No');
  });
});
