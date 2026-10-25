import { play, startFails } from '@testing/games';
import ChainedStoryPage from '@features/games/presentation/pages/chained-story.page';
// [Spec ChainedStoryPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('ChainedStoryPage', () => {
  it('al empezar muestra el juego «Historia encadenada»', async () => {
    const r = await play(ChainedStoryPage, 'chained_story', 'Historia encadenada', { target: null, forbidden: [] });
    expect(r.el.textContent).toContain('Remote work is the future');
    expect(r.el.querySelector('[role="timer"]')).not.toBeNull(); // Cuenta regresiva por turno
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(ChainedStoryPage);
  });
});
