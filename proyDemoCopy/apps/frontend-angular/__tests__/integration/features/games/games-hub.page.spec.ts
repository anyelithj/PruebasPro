import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { gameProviders, gameSession } from '@testing/games';
import GamesHubPage from '@features/games/presentation/pages/games-hub.page';
// [Spec GamesHubPage · Sprint 8.8]: catálogo agrupado por familia con la habilidad en texto, enlaces con preferencias (?lang=&d=), licencia del contenido (8.17), historial y error | [Herramienta]: render() + msw

const catalog = {
  games: [
    { type: 'memory', family: 'vocab', skill: 'Asociación' },
    { type: 'taboo', family: 'agent', skill: 'Producción oral', agentGame: 'taboo' },
    { type: 'shadowing', family: 'listening', skill: 'Pronunciación' },
  ],
  license: { license: 'CC BY 4.0', author: 'Aula de Idiomas', source: 'Contenido original del proyecto' },
};

describe('GamesHubPage', () => {
  it('catálogo por familias, enlaces con preferencias, licencia y últimas partidas', async () => {
    server.use(
      http.get(`${API}/games/catalog`, () => HttpResponse.json(envelope(catalog))),
      http.get(`${API}/games/sessions/me`, () => HttpResponse.json(envelope([{ ...gameSession('memory'), status: 'finished', score: 30, roundsCount: 4, correctCount: 3 }]))),
    );
    const { el } = await render(GamesHubPage, gameProviders);
    expect(el.textContent).toContain('Vocabulario y memoria');
    expect(el.textContent).toContain('Conversa y juega con Aula (agente de IA)');
    expect(el.textContent).toContain('Asociación');
    const link = el.querySelector('a[href^="/juegos/memory"]');
    expect(link?.getAttribute('href')).toContain('lang=en');
    expect(el.textContent).toContain('CC BY 4.0');
    expect(el.textContent).toContain('Terminada');
    expect(el.textContent).toContain('75 %');
  });

  it('sin partidas → mensaje; error del catálogo → alerta', async () => {
    server.use(
      http.get(`${API}/games/catalog`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })),
      http.get(`${API}/games/sessions/me`, () => HttpResponse.json(envelope([]))),
    );
    const { el } = await render(GamesHubPage, gameProviders);
    expect(getByRole(el, 'alert')).toBeTruthy();
    expect(el.textContent).toContain('Todavía no has jugado');
  });
});
