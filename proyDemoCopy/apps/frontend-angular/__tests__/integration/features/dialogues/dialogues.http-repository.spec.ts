import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { DialoguesHttpRepository } from '@features/dialogues/infrastructure/dialogues.http-repository';
import { dialogue, session, topic, turn } from '@testing/music-dialogues';
// [Spec DialoguesHttpRepository · Sprints 9.11–9.13]: filtros de la biblioteca, PATCH del nivel, inicio de conversación, turno por SSE (POST) y transcripción multipart | [Herramienta]: msw 2

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), DialoguesHttpRepository] });
  return TestBed.inject(DialoguesHttpRepository);
}

describe('DialoguesHttpRepository', () => {
  it('biblioteca con filtros; confirmar nivel por PATCH', async () => {
    let url = '';
    let body: unknown;
    server.use(
      http.get(`${API}/dialogues`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(envelope([dialogue()]));
      }),
      http.patch(`${API}/dialogues/d1/level`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(dialogue({ level: 'B1' })));
      }),
    );
    const repo = setup();
    const list = await firstValueFrom(repo.listDialogues({ language: 'fr', level: '', topic: 'tp1' }));
    expect(new URL(url).searchParams.toString()).toBe('language=fr&topic=tp1');
    expect(list[0].levelEstimate?.method).toBe('measures');
    expect((await firstValueFrom(repo.confirmLevel('d1', 'B1'))).level).toBe('B1');
    expect(body).toEqual({ level: 'B1' });
  });

  it('iniciar conversación y recibir el turno por SSE', async () => {
    const sse = [
      `event: user\ndata: ${JSON.stringify(turn(1, 'user', 'Hi'))}\n\n`,
      `event: token\ndata: ${JSON.stringify({ text: 'Hello ' })}\n\n`,
      `event: avatar\ndata: ${JSON.stringify(turn(2, 'avatar', 'Hello there'))}\n\n`,
      'event: done\ndata: {}\n\n',
    ].join('');
    server.use(
      http.post(`${API}/dialogues/sessions`, () => HttpResponse.json(envelope({ session: session(), topic, turns: [turn(0, 'avatar', 'Hi!')] }), { status: 201 })),
      http.post(`${API}/dialogues/sessions/ss1/turns/stream`, () => new HttpResponse(sse, { headers: { 'content-type': 'text/event-stream' } })),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.startSession({ topicId: 'tp1', language: 'en', level: 'A2' }))).turns[0].text).toBe('Hi!');
    const events = await firstValueFrom(repo.streamTurn('ss1', 'Hi').pipe(toArray()));
    expect(events.map((e) => e.type)).toEqual(['user', 'token', 'avatar', 'done']);
  });

  it('transcribir devuelve el texto; 503 → ApiError', async () => {
    server.use(http.post(`${API}/speech/transcribe`, () => HttpResponse.json({ message: 'El reconocimiento de voz no está disponible' }, { status: 503 })));
    await expect(firstValueFrom(setup().transcribe(new Blob(['x']), 'en'))).rejects.toEqual(new ApiError(503, 'El reconocimiento de voz no está disponible'));
  });
});
