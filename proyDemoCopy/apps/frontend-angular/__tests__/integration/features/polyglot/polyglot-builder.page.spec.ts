import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { PolyglotFacade } from '@features/polyglot/application/polyglot.facade';
import { PolyglotRepository } from '@features/polyglot/domain/polyglot.repository.port';
import { PolyglotHttpRepository } from '@features/polyglot/infrastructure/polyglot.http-repository';
import PolyglotBuilderPage from '@features/polyglot/presentation/pages/polyglot-builder.page';
import { sessionAs } from '@testing/music-dialogues';
import { pgTable, pgTopic } from '@testing/polyglot-grammar';
// [Spec PolyglotBuilderPage · Sprint 10.8]: el docente ve el estado del tema (borrador en texto), publica y obtiene el IPA; el error del backend se muestra | [Herramienta]: render() + msw

const providers = [{ provide: PolyglotRepository, useClass: PolyglotHttpRepository }, PolyglotFacade, sessionAs('TEACHER')];

describe('PolyglotBuilderPage', () => {
  it('tema en borrador: «Publicar» envía status=published', async () => {
    let body: unknown;
    server.use(
      http.get(`${API}/polyglot/topics`, () => HttpResponse.json(envelope([pgTopic({ status: 'draft' })]))),
      http.get(`${API}/polyglot/table`, () => HttpResponse.json(envelope(pgTable()))),
      http.patch(`${API}/polyglot/topics/p1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(pgTopic()));
      }),
    );
    const { el, fixture } = await render(PolyglotBuilderPage, providers);
    expect(el.textContent).toContain('Borrador');
    const publish = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Publicar'))!;
    publish.click();
    await settle(fixture);
    expect(body).toEqual({ status: 'published' });
  });

  it('«Obtener IPA» informa cuántos términos se actualizaron; error visible', async () => {
    server.use(
      http.get(`${API}/polyglot/topics`, () => HttpResponse.json(envelope([pgTopic()]))),
      http.get(`${API}/polyglot/table`, () => HttpResponse.json(envelope(pgTable()))),
      http.post(`${API}/polyglot/topics/p1/ipa`, () => HttpResponse.json({ message: 'El servicio de traducción e IPA no está disponible' }, { status: 503 })),
    );
    const { el, fixture } = await render(PolyglotBuilderPage, providers);
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Obtener IPA'))!.click();
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('no está disponible');
  });
});
