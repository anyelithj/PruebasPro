import type { Type } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { GameAgentFacade } from '@features/games/application/game-agent.facade';
import { GamesFacade } from '@features/games/application/games.facade';
import { SpeechFacade } from '@features/games/application/speech.facade';
import { GamesRepository } from '@features/games/domain/games.repository.port';
import { GamesHttpRepository } from '@features/games/infrastructure/games.http-repository';
// [Utilidades de pruebas de Games · Sprints 8.8–8.11]: fixtures de partida y un «jugar» común (render → Empezar → contenido del juego) para las specs de cada página | [Patrón]: Test Helper + Object Mother | [Principio]: DRY (18 páginas, un arranque)

// [scenario]: escenario de role-play (aeropuerto) con un objetivo y vocabulario clave
export const scenario = { id: 'sc1', slug: 'en-airport', title: 'En el aeropuerto', language: 'en', level: 'A2', emoji: '🛫', role: 'an airline check-in agent', opening: 'Hello! Can I see your passport?', objectives: [{ id: 'documents', text: 'Entrega tus documentos', keywords: ['passport'] }], vocabulary: ['passport', 'gate'], createdBy: null, archivedAt: null, createdAt: '' };

export const gameProviders = [{ provide: GamesRepository, useClass: GamesHttpRepository }, GamesFacade, GameAgentFacade, SpeechFacade];

// [session]: partida activa con contenido suficiente para cualquier juego (vocabulario con emoji/categoría, frases, tema, objetivos)
export const gameSession = (gameType: string, content: Record<string, unknown> = {}) => ({
  id: 's1',
  userId: 'u1',
  gameType,
  language: 'en',
  level: 'A2',
  difficulty: 1,
  scenarioId: null,
  status: 'active',
  score: 0,
  roundsCount: 0,
  correctCount: 0,
  createdAt: '2026-10-17T00:00:00Z',
  finishedAt: null,
  content: {
    vocabulary: [
      { term: 'apple', emoji: '🍎', category: 'food' },
      { term: 'airport', emoji: '🛫', category: 'places' },
      { term: 'coffee', emoji: '☕', category: 'food' },
    ],
    lines: [{ text: 'I take the bus to work', gap: 'bus', answer: 'work' }],
    topic: 'Remote work is the future',
    target: 'apple',
    forbidden: ['fruit', 'red'],
    fallback: false,
    ...content,
  },
});

// [play]: monta la página, comprueba el título, pulsa «Empezar» y devuelve el DOM ya en juego
export async function play<T>(page: Type<T>, gameType: string, title: string, content: Record<string, unknown> = {}) {
  server.use(http.post(`${API}/games/sessions`, () => HttpResponse.json(envelope(gameSession(gameType, content)), { status: 201 })));
  const r = await render(page, gameProviders);
  expect(r.el.querySelector('h1')?.textContent).toContain(title);
  getByRole(r.el, 'button', 'Empezar').click();
  await settle(r.fixture);
  return r;
}

// [startFails]: el backend rechaza la partida → la alerta se ve y se sigue en «preparar»
export async function startFails<T>(page: Type<T>) {
  server.use(http.post(`${API}/games/sessions`, () => HttpResponse.json({ message: 'No hay suficientes palabras para este juego' }, { status: 400 })));
  const r = await render(page, gameProviders);
  getByRole(r.el, 'button', 'Empezar').click();
  await settle(r.fixture);
  expect(getByRole(r.el, 'alert').textContent).toContain('suficientes');
  expect(getByRole(r.el, 'button', 'Empezar')).toBeTruthy();
}
