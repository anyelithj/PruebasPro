import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { gameProviders } from '@testing/games';
import FlashcardsPage from '@features/games/presentation/pages/flashcards.page';
// [Spec FlashcardsPage · Sprint 8.8]: pide recordar antes de mostrar; mostrar → calificar (SM-2) saca la tarjeta; mazo vacío ofrece llenarlo con el vocabulario | [Herramienta]: render() + msw

const card = { id: 'c1', userId: 'u1', entryId: 'e1', repetitions: 0, intervalDays: '0', ease: '2.50', dueAt: '', lastQuality: null, createdAt: '', entry: { id: 'e1', term: 'umbrella', translation: 'paraguas', language: 'en', example: 'Take an umbrella' } };

describe('FlashcardsPage', () => {
  it('recordar primero → mostrar respuesta → «Bien» envía calidad 4 y vacía el mazo de hoy', async () => {
    let quality: unknown;
    server.use(
      http.get(`${API}/games/flashcards/due`, () => HttpResponse.json(envelope([card]))),
      http.post(`${API}/games/flashcards/c1/review`, async ({ request }) => {
        quality = await request.json();
        return HttpResponse.json(envelope({ ...card, repetitions: 1 }), { status: 201 });
      }),
    );
    const { fixture, el } = await render(FlashcardsPage, gameProviders);
    expect(el.textContent).toContain('Primero intenta recordarla');
    expect(el.textContent).not.toContain('paraguas');
    getByRole(el, 'button', 'Mostrar respuesta').click();
    await settle(fixture);
    expect(el.textContent).toContain('paraguas');
    getByRole(el, 'button', 'Bien').click();
    await settle(fixture);
    expect(quality).toEqual({ quality: 4 });
    expect(el.textContent).toContain('No tienes tarjetas para hoy');
  });

  it('mazo vacío: «Agregar mi vocabulario al mazo» da de alta cada entrada', async () => {
    const added: unknown[] = [];
    server.use(
      http.get(`${API}/games/flashcards/due`, () => HttpResponse.json(envelope([]))),
      http.get(`${API}/vocabulary`, () => HttpResponse.json(envelope([{ id: 'e1' }, { id: 'e2' }]))),
      http.post(`${API}/games/flashcards`, async ({ request }) => {
        added.push(await request.json());
        return HttpResponse.json(envelope({}), { status: 201 });
      }),
    );
    const { fixture, el } = await render(FlashcardsPage, gameProviders);
    getByRole(el, 'button', 'Agregar mi vocabulario al mazo').click();
    await settle(fixture);
    expect(added).toEqual([{ entryId: 'e1' }, { entryId: 'e2' }]);
    expect(el.textContent).toContain('Se agregaron 2 palabras');
  });
});
