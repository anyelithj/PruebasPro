import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { gameProviders, scenario } from '@testing/games';
import ScenarioListPage from '@features/games/presentation/pages/scenario-list.page';
// [Spec ScenarioListPage · Sprint 8.9]: escenarios del idioma con objetivos y enlace al role-play; vacío | [Herramienta]: render() + msw


describe('ScenarioListPage', () => {
  it('lista escenarios con su rol y objetivos (filtra por idioma)', async () => {
    let url = '';
    server.use(
      http.get(`${API}/games/scenarios`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(envelope([scenario]));
      }),
    );
    const r = await render(ScenarioListPage, gameProviders);
    await settle(r.fixture);
    expect(new URL(url).searchParams.get('language')).toBe('en');
    expect(r.el.textContent).toContain('En el aeropuerto');
    expect(r.el.textContent).toContain('an airline check-in agent');
    expect(r.el.querySelector('a[href="/juegos/role-play/sc1"]')).not.toBeNull();
  });

  it('sin escenarios → mensaje', async () => {
    server.use(http.get(`${API}/games/scenarios`, () => HttpResponse.json(envelope([]))));
    const r = await render(ScenarioListPage, gameProviders);
    await settle(r.fixture);
    expect(r.el.textContent).toContain('No hay escenarios');
  });
});
