import { play, startFails } from '@testing/games';
import BingoPage from '@features/games/presentation/pages/bingo.page';
// [Spec BingoPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('BingoPage', () => {
  it('al empezar muestra el juego «Bingo de palabras»', async () => {
    const r = await play(BingoPage, 'bingo', 'Bingo de palabras', {});
    expect(r.el.textContent).toContain('Marca en el tablero');
    expect(r.el.textContent).toContain('airport');
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(BingoPage);
  });
});
