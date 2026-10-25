import { play, startFails } from '@testing/games';
import ListenReformulatePage from '@features/games/presentation/pages/listen-reformulate.page';
// [Spec ListenReformulatePage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('ListenReformulatePage', () => {
  it('al empezar muestra el juego «Escucha y reformula»', async () => {
    const r = await play(ListenReformulatePage, 'listen_reformulate', 'Escucha y reformula', {});
    expect(r.el.textContent).not.toContain('I take the bus to work'); // Oculta hasta responder
    expect(r.el.querySelector('textarea')).not.toBeNull();
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(ListenReformulatePage);
  });
});
