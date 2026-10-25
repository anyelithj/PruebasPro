import { play, startFails } from '@testing/games';
import SpeedSpeakingPage from '@features/games/presentation/pages/speed-speaking.page';
// [Spec SpeedSpeakingPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('SpeedSpeakingPage', () => {
  it('al empezar muestra el juego «Hablar contra reloj»', async () => {
    const r = await play(SpeedSpeakingPage, 'speed_speaking', 'Hablar contra reloj', {});
    expect(r.el.textContent).toContain('Nivel 30 s');
    expect(r.el.textContent).toContain('Nivel 90 s');
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(SpeedSpeakingPage);
  });
});
