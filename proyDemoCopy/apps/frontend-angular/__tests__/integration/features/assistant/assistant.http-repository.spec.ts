import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { parseSseFrames } from '@features/assistant/domain/models/assistant';
import { AssistantHttpRepository } from '@features/assistant/infrastructure/assistant.http-repository';
// [Spec AssistantHttpRepository]: POST en streaming con msw (eventos session/token/done troceados), 503 → ApiError y parser SSE puro | [Herramienta]: msw 2 (ReadableStream)

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), AssistantHttpRepository] });
  return TestBed.inject(AssistantHttpRepository);
}

describe('AssistantHttpRepository', () => {
  it('lee el flujo aunque los eventos lleguen partidos', async () => {
    let body: unknown;
    const text = sse('session', { session_id: 's1' }) + sse('token', { text: 'Hi ' }) + sse('token', { text: 'there' }) + sse('done', {});
    server.use(
      http.post(`${API}/ai/assistant/chat/stream`, async ({ request }) => {
        body = await request.json();
        // `ReadableStream` (Web Streams): trozos de 7 bytes → prueba el reensamblado de eventos
        const stream = new ReadableStream({
          start(c) {
            for (let i = 0; i < text.length; i += 7) c.enqueue(new TextEncoder().encode(text.slice(i, i + 7)));
            c.close();
          },
        });
        return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );
    const chunks = await firstValueFrom(setup().stream({ message: 'hello', language: 'en' }).pipe(toArray()));
    expect(body).toEqual({ message: 'hello', language: 'en' });
    expect(chunks).toEqual([{ type: 'session', sessionId: 's1' }, { type: 'token', text: 'Hi ' }, { type: 'token', text: 'there' }, { type: 'done' }]);
  });

  it('503 del tutor llega como ApiError', async () => {
    server.use(http.post(`${API}/ai/assistant/chat/stream`, () => HttpResponse.json({ message: 'El tutor no está disponible en este momento' }, { status: 503 })));
    await expect(firstValueFrom(setup().stream({ message: 'x' }).pipe(toArray()))).rejects.toEqual(new ApiError(503, 'El tutor no está disponible en este momento'));
  });

  it('parseSseFrames deja el trozo incompleto para la siguiente lectura', () => {
    const { chunks, rest } = parseSseFrames(sse('token', { text: 'a' }) + 'event: tok');
    expect(chunks).toEqual([{ type: 'token', text: 'a' }]);
    expect(rest).toBe('event: tok');
  });
});
