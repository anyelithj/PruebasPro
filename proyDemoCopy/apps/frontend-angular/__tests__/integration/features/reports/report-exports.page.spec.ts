import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { FakeEventSource } from '@testing/fake-event-source';
import { render, settle } from '@testing/render';
import { expectAllNamed, getByRole } from '@testing/a11y';
import { REPORTS_PROVIDERS } from '@features/reports/reports.providers';
import ReportExportsPage from '@features/reports/presentation/pages/report-exports.page';
// [Spec ReportExportsPage]: contenedor — vacío, error, solicitar, estado en vivo y enlace de descarga | [Herramienta]: render() con HTTP real contra msw

const row = { id: 'r1', format: 'pdf', periodMonths: null, status: 'processing', sizeBytes: null, error: null, createdAt: '2026-10-15T00:00:00Z' };

describe('ReportExportsPage', () => {
  it('estado vacío y solicitar una exportación la muestra «En cola»', async () => {
    server.use(http.post(`${API}/reports/export`, () => HttpResponse.json(envelope({ ...row, status: 'pending' }), { status: 202 })));
    const { fixture, el } = await render(ReportExportsPage, REPORTS_PROVIDERS);
    expect(el.textContent).toContain('Aún no has exportado reportes');
    getByRole(el, 'button', 'Exportar').click(); // [2026-10-19]: select de formato (PDF por defecto) + botón «Exportar»
    await settle(fixture);
    expect(el.textContent).toContain('En cola');
  });

  it('el evento en vivo pasa la fila a «Listo» y aparece la descarga', async () => {
    server.use(http.get(`${API}/reports/export/me`, () => HttpResponse.json(envelope([row]))));
    const { fixture, el } = await render(ReportExportsPage, REPORTS_PROVIDERS);
    expect(el.textContent).toContain('Generando');
    FakeEventSource.last('/events').emit('report-export', { id: 'r1', status: 'ready', sizeBytes: 4096 });
    await settle(fixture);
    expect(el.textContent).toContain('Listo');
    expect(getByRole(el, 'link', 'Descargar').getAttribute('href')).toBe(`${API}/reports/export/r1/download`);
    expectAllNamed(el);
  });

  it('error al cargar', async () => {
    server.use(http.get(`${API}/reports/export/me`, () => HttpResponse.json({ message: 'Forbidden resource' }, { status: 403 })));
    const { el } = await render(ReportExportsPage, REPORTS_PROVIDERS);
    expect(getByRole(el, 'alert').textContent).toContain('Forbidden');
  });
});
