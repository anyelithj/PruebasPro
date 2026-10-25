import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { gameProviders, gameSession, scenario } from '@testing/games';
import RolePlayPage from '@features/games/presentation/pages/role-play.page';
// [Spec RolePlayPage · Sprint 8.9]: escenario → empezar (envía scenarioId) → apertura del agente, objetivos «Pendiente» → turno que los marca «Cumplido» | [Herramienta]: render() + setInput + msw

describe('RolePlayPage', () => {
  it('objetivos pendientes → cumplidos tras el turno del agente', async () => {
    let started: unknown;
    server.use(
      http.get(`${API}/games/scenarios/sc1`, () => HttpResponse.json(envelope(scenario))),
      http.post(`${API}/games/sessions`, async ({ request }) => {
        started = await request.json();
        return HttpResponse.json(envelope(gameSession('role_play', { objectives: scenario.objectives, met: [], target: null, forbidden: [] })), { status: 201 });
      }),
      http.post(`${API}/games/agent/turn`, () => HttpResponse.json(envelope({ reply: 'Thank you. Any luggage?', state: { met: ['documents'] }, round: { id: 'r1', index: 1, prompt: '', answer: 'Here is my passport', correct: null, timeToAnswerMs: 1000, durationMs: null, wordsProduced: 4, evaluation: {}, createdAt: '' }, finished: false }), { status: 201 })),
    );
    const r = await render(RolePlayPage, gameProviders);
    r.fixture.componentRef.setInput('scenarioId', 'sc1');
    await settle(r.fixture);
    expect(r.el.textContent).toContain('En el aeropuerto');
    getByRole(r.el, 'button', 'Empezar').click();
    await settle(r.fixture);
    expect(started).toEqual(expect.objectContaining({ gameType: 'role_play', scenarioId: 'sc1', language: 'en' }));
    expect(r.el.textContent).toContain('Hello! Can I see your passport?');
    expect(r.el.textContent).toContain('Pendiente');
    const box = r.el.querySelector('textarea#agent-message') as HTMLTextAreaElement;
    box.value = 'Here is my passport';
    box.dispatchEvent(new Event('input'));
    await settle(r.fixture);
    getByRole(r.el, 'button', 'Enviar').click();
    await settle(r.fixture);
    expect(r.el.textContent).toContain('Any luggage?');
    expect(r.el.textContent).toContain('Cumplido');
  });
});
