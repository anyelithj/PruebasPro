import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { gameProviders, gameSession } from '@testing/games';
import FluencyDashboardPage from '@features/games/presentation/pages/fluency-dashboard.page';
// [Spec FluencyDashboardPage · Sprint 8.11]: promedios de las métricas, gráfica SVG accesible (role="img" + tabla oculta) y estado vacío | [Herramienta]: render() + msw

const m = (wpm: string, at: string) => ({ id: at, sessionId: 's1', roundId: null, timeToRespondS: '2', speakingTimeS: '30', pauses: 4, longestRunS: '6', wordsProduced: 50, wordsPerMinute: wpm, reuseRatio: '0.5', createdAt: at });

describe('FluencyDashboardPage', () => {
  it('promedios + tendencia en orden cronológico', async () => {
    server.use(
      http.get(`${API}/games/fluency/me`, () => HttpResponse.json(envelope([m('120', '2026-10-17T02:00:00Z'), m('80', '2026-10-16T02:00:00Z')]))),
      // Dos conversaciones con el agente (4 y 6 turnos) + una de vocabulario que no cuenta
      http.get(`${API}/games/sessions/me`, () => HttpResponse.json(envelope([{ ...gameSession('taboo'), roundsCount: 4 }, { ...gameSession('debate'), id: 's2', roundsCount: 6 }, { ...gameSession('memory'), id: 's3', roundsCount: 9 }]))),
    );
    const { el } = await render(FluencyDashboardPage, gameProviders);
    expect(el.textContent).toContain('Tiempo hasta responder');
    expect(el.textContent).toContain('50 %');
    const svg = el.querySelector('svg[role="img"]');
    expect(svg?.getAttribute('aria-label')).toContain('80 → 120');
    expect(el.querySelectorAll('table.sr-only tr')).toHaveLength(2);
    expect(el.textContent).toContain('Turnos sostenidos');
    const card = [...el.querySelectorAll('dl')].find((d) => d.textContent?.includes('Turnos sostenidos'));
    expect(card?.querySelector('dd')?.textContent?.trim()).toBe('5'); // (4 + 6) / 2; memory no cuenta
  });

  it('sin métricas → invita a jugar Tema al azar', async () => {
    server.use(
      http.get(`${API}/games/fluency/me`, () => HttpResponse.json(envelope([]))),
      http.get(`${API}/games/sessions/me`, () => HttpResponse.json(envelope([]))),
    );
    const { el } = await render(FluencyDashboardPage, gameProviders);
    expect(el.textContent).toContain('Aún no hay métricas');
    expect(el.querySelector('a[href="/juegos/tema"]')).not.toBeNull();
  });
});
