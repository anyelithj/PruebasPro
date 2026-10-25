import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { gameProviders, gameSession } from '@testing/games';
import GameResultPage from '@features/games/presentation/pages/game-result.page';
// [Spec GameResultPage · Sprints 8.8/8.11]: puntaje, aciertos, rondas con resultado en texto y métricas de fluidez promediadas; 404 → alerta | [Herramienta]: render() + setInput + msw

const round = (i: number, correct: boolean | null) => ({ id: `r${i}`, index: i, prompt: '', answer: `answer ${i}`, correct, timeToAnswerMs: 1500, durationMs: null, wordsProduced: 2, evaluation: {}, createdAt: '' });
const metric = { id: 'm1', sessionId: 's1', roundId: null, timeToRespondS: '1.20', speakingTimeS: '20', pauses: 2, longestRunS: '8.5', wordsProduced: 40, wordsPerMinute: '110', reuseRatio: '0.40', createdAt: '' };

async function open(id: string) {
  const r = await render(GameResultPage, gameProviders);
  r.fixture.componentRef.setInput('id', id);
  await settle(r.fixture);
  return r;
}

describe('GameResultPage', () => {
  it('resumen con rondas (✓/✗/Abierta) y métricas de fluidez', async () => {
    server.use(http.get(`${API}/games/sessions/s1`, () => HttpResponse.json(envelope({ session: { ...gameSession('random_topic'), status: 'finished', score: 20, roundsCount: 3, correctCount: 1 }, rounds: [round(1, true), round(2, false), round(3, null)], metrics: [metric] }))));
    const { el } = await open('s1');
    expect(el.querySelector('h1')?.textContent).toContain('Tema al azar');
    expect(el.textContent).toContain('33 %');
    expect(el.textContent).toContain('¡Correcto!');
    expect(el.textContent).toContain('No es correcto');
    expect(el.textContent).toContain('Abierta');
    expect(el.textContent).toContain('110');
    expect(el.textContent).toContain('40 %'); // Vocabulario reutilizado
  });

  it('partida inexistente → alerta', async () => {
    server.use(http.get(`${API}/games/sessions/zz`, () => HttpResponse.json({ message: 'Partida no encontrada' }, { status: 404 })));
    const { el } = await open('zz');
    expect(getByRole(el, 'alert').textContent).toContain('no encontrada');
  });
});
