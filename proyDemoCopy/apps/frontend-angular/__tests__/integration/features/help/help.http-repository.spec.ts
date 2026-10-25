import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { HelpHttpRepository } from '@features/help/infrastructure/help.http-repository';
// [Spec HelpHttpRepository]: idioma en la consulta, cuerpo de la FAQ sin artículo vacío, SSE del Agente Guía con `sources`, valoración y 404 → ApiError | [Herramienta]: msw 2 (ReadableStream para el SSE)

const faq = { id: 'f1', question: '¿Cómo pago?', answer: 'Con tarjeta.', category: 'pagos', role: 'ALL', locale: 'en', manualSlug: null, reviewedAt: '2026-10-16T00:00:00Z', status: 'published' };
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), HelpHttpRepository] });
  return TestBed.inject(HelpHttpRepository);
}

describe('HelpHttpRepository', () => {
  it('GET /help/faqs envía el idioma y valida la forma', async () => {
    let locale: string | null = null;
    server.use(
      http.get(`${API}/help/faqs`, ({ request }) => {
        locale = new URL(request.url).searchParams.get('locale');
        return HttpResponse.json(envelope([faq]));
      }),
    );
    expect((await firstValueFrom(setup().faqs('en')))[0].question).toBe('¿Cómo pago?');
    expect(locale).toBe('en');
  });

  it('crear FAQ sin artículo no envía manualSlug vacío', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/help/faqs`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(envelope(faq), { status: 201 });
      }),
    );
    await firstValueFrom(setup().createFaq({ question: '¿Cómo pago?', answer: 'Con tarjeta.', category: 'pagos', role: 'ALL', locale: 'es', manualSlug: '' }));
    expect(bodies).toEqual([{ question: '¿Cómo pago?', answer: 'Con tarjeta.', category: 'pagos', role: 'ALL', locale: 'es' }]);
  });

  it('el Agente Guía llega en streaming con sus fuentes (trozos partidos)', async () => {
    const body = sse('session', { session_id: 's1' }) + sse('token', { text: 'Hola ' }) + sse('sources', { sources: [{ kind: 'faq', id: 'f1', title: '¿Cómo pago?', ref: null }], answered_by: 'faq' }) + sse('done', {});
    server.use(
      http.post(`${API}/help/ask/stream`, () => {
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          start(c) {
            c.enqueue(enc.encode(body.slice(0, 30)));
            c.enqueue(enc.encode(body.slice(30)));
            c.close();
          },
        });
        return new HttpResponse(stream, { headers: { 'content-type': 'text/event-stream' } });
      }),
    );
    const chunks = await firstValueFrom(setup().ask({ message: '¿pago?', locale: 'es' }).pipe(toArray()));
    expect(chunks.map((c) => c.type)).toEqual(['session', 'token', 'sources', 'done']);
  });

  it('valorar envía índice, voto y origen al id de la conversación', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/help/ask/s1/feedback`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(envelope({}), { status: 201 });
      }),
    );
    await firstValueFrom(setup().rate('s1', 1, false, 'manual', '/courses'));
    expect(bodies).toEqual([{ messageIndex: 1, helpful: false, answeredBy: 'manual', route: '/courses' }]);
  });

  it('artículo inexistente → ApiError 404', async () => {
    server.use(http.get(`${API}/help/manual/nada`, () => HttpResponse.json({ message: 'Artículo del manual no encontrado' }, { status: 404 })));
    await expect(firstValueFrom(setup().article('nada', 'es'))).rejects.toEqual(new ApiError(404, 'Artículo del manual no encontrado'));
  });
});
