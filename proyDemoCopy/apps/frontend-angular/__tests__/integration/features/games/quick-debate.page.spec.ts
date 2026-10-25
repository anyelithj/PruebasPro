import { play, startFails } from '@testing/games';
import QuickDebatePage from '@features/games/presentation/pages/quick-debate.page';
// [Spec QuickDebatePage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('QuickDebatePage', () => {
  it('al empezar muestra el juego «Debate rápido»', async () => {
    const r = await play(QuickDebatePage, 'debate', 'Debate rápido', { target: null, forbidden: [] });
    expect(r.el.textContent).toContain('Remote work is the future');
    expect(r.el.querySelector('[role="timer"]')).not.toBeNull();
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(QuickDebatePage);
  });
});
