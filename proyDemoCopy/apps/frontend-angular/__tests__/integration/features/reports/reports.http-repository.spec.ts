import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { FakeEventSource } from '@testing/fake-event-source';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { ReportsHttpRepository } from '@features/reports/infrastructure/reports.http-repository';
// [Spec ReportsHttpRepository]: cuerpo de la petición (sin periodo si no hay), envelope, 403 → ApiError, URL de descarga y SSE `report-export` | [Herramienta]: msw 2 + FakeEventSource

const exportRow = { id: 'r1', format: 'xlsx', periodMonths: 6, status: 'pending', sizeBytes: null, error: null, createdAt: '2026-10-15T00:00:00Z' };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), ReportsHttpRepository] });
  return TestBed.inject(ReportsHttpRepository);
}

describe('ReportsHttpRepository', () => {
  it('POST con formato y periodo; sin periodo no envía la clave', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/reports/export`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(envelope(exportRow), { status: 202 });
      }),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.request('xlsx', 6))).id).toBe('r1');
    await firstValueFrom(repo.request('pdf', null));
    expect(bodies).toEqual([{ format: 'xlsx', periodMonths: 6 }, { format: 'pdf' }]);
  });

  it('403 de NestJS (no ADMIN) llega como ApiError', async () => {
    server.use(http.get(`${API}/reports/export/me`, () => HttpResponse.json({ message: 'Forbidden resource' }, { status: 403 })));
    await expect(firstValueFrom(setup().mine())).rejects.toEqual(new ApiError(403, 'Forbidden resource'));
  });

  it('descarga por el BFF y progreso por /api/events', async () => {
    const repo = setup();
    expect(repo.downloadUrl('a b')).toBe(`${API}/reports/export/a%20b/download`);
    const got = firstValueFrom(repo.progress().pipe(take(1)));
    FakeEventSource.last('/events').emit('report-export', { id: 'r1', status: 'ready', sizeBytes: 10 });
    await expect(got).resolves.toEqual({ id: 'r1', status: 'ready', sizeBytes: 10 });
  });
});
