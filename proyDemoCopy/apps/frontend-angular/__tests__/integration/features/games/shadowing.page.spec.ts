import { play, startFails } from '@testing/games';
import ShadowingPage from '@features/games/presentation/pages/shadowing.page';
// [Spec ShadowingPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('ShadowingPage', () => {
  it('al empezar muestra el juego «Shadowing»', async () => {
    const r = await play(ShadowingPage, 'shadowing', 'Shadowing', {});
    expect(r.el.textContent).toContain('I take the bus to work'); // En shadowing la frase se ve
    expect(r.el.textContent).toContain('Grabar');
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(ShadowingPage);
  });
});
