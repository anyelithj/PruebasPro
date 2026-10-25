import { play, startFails } from '@testing/games';
import DescribeGuessPage from '@features/games/presentation/pages/describe-guess.page';
// [Spec DescribeGuessPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('DescribeGuessPage', () => {
  it('al empezar muestra el juego «Describe y adivina»', async () => {
    const r = await play(DescribeGuessPage, 'describe_guess', 'Describe y adivina', { target: null, forbidden: [] });
    expect(r.el.textContent).toContain('El agente describe');
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(DescribeGuessPage);
  });
});
