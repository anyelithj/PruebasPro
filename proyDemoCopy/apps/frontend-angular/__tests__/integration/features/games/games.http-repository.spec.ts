import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { GamesHttpRepository } from '@features/games/infrastructure/games.http-repository';
// [Spec GamesHttpRepository · Sprints 8.8–8.11]: partida, ronda (veredicto + métrica con decimales como texto), turno del agente, audio multipart y 404 → ApiError | [Herramienta]: msw 2

const session = { id: 's1', userId: 'u1', gameType: 'shadowing', language: 'en', level: null, difficulty: 1, scenarioId: null, content: { vocabulary: [], lines: [{ text: 'I take the bus', gap: 'bus', answer: 'bus' }], fallback: false }, status: 'active', score: 0, roundsCount: 0, correctCount: 0, createdAt: '', finishedAt: null };
const round = { id: 'r1', sessionId: 's1', userId: 'u1', index: 1, prompt: '', answer: 'I take the bus', correct: true, timeToAnswerMs: 800, durationMs: 2000, wordsProduced: 4, evaluation: { overlap: 1 }, createdAt: '' };
const metric = { id: 'm1', userId: 'u1', sessionId: 's1', roundId: 'r1', timeToRespondS: '0.80', speakingTimeS: '2.00', pauses: 0, longestRunS: '2.00', wordsProduced: 4, wordsPerMinute: '120.00', reuseRatio: '0.50', createdAt: '' };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), GamesHttpRepository] });
  return TestBed.inject(GamesHttpRepository);
}

describe('GamesHttpRepository', () => {
  it('empezar y responder: veredicto + métrica (decimal de PostgreSQL → número)', async () => {
    server.use(
      http.post(`${API}/games/sessions`, () => HttpResponse.json(envelope(session), { status: 201 })),
      http.post(`${API}/games/sessions/s1/rounds`, () => HttpResponse.json(envelope({ round, verdict: { correct: true, overlap: 1 }, metric }), { status: 201 })),
    );
    const repo = setup();
    const s = await firstValueFrom(repo.start({ gameType: 'shadowing', language: 'en' }));
    expect(s.content.lines?.[0].gap).toBe('bus');
    const r = await firstValueFrom(repo.submitRound('s1', { answer: 'I take the bus', lineIndex: 0 }));
    expect(r.metric?.wordsPerMinute).toBe(120);
    expect(r.verdict.correct).toBe(true);
  });

  it('turno del agente envía sessionId + mensaje + tiempo; transcribir usa multipart', async () => {
    const seen: unknown[] = [];
    server.use(
      http.post(`${API}/games/agent/turn`, async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json(envelope({ reply: 'Hmm…', state: { violation: true }, round, finished: false }), { status: 201 });
      }),
      http.post(`${API}/speech/transcribe`, async ({ request }) => {
        seen.push(request.headers.get('content-type')?.split(';')[0]);
        return HttpResponse.json(envelope({ text: 'hi', language: 'en', duration: 1, words: [{ word: 'hi', start: 0, end: 0.3 }], model: 'small' }), { status: 201 });
      }),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.agentTurn('s1', 'red fruit', 1500))).state['violation']).toBe(true);
    expect((await firstValueFrom(repo.transcribe(new Blob(['x'], { type: 'audio/webm' }), 'en'))).words).toHaveLength(1);
    expect(seen).toEqual([{ sessionId: 's1', message: 'red fruit', timeToAnswerMs: 1500 }, 'multipart/form-data']);
  });

  it('partida ajena → 404 como ApiError', async () => {
    server.use(http.get(`${API}/games/sessions/zz`, () => HttpResponse.json({ message: 'Partida no encontrada' }, { status: 404 })));
    await expect(firstValueFrom(setup().session('zz'))).rejects.toEqual(new ApiError(404, 'Partida no encontrada'));
  });
});
