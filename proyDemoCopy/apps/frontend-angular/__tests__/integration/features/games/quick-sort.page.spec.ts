import { play, startFails } from '@testing/games';
import QuickSortPage from '@features/games/presentation/pages/quick-sort.page';
// [Spec QuickSortPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('QuickSortPage', () => {
  it('al empezar muestra el juego «Clasificación rápida»', async () => {
    const r = await play(QuickSortPage, 'quick_sort', 'Clasificación rápida', {});
    expect(r.el.textContent).toContain('food');
    expect(r.el.textContent).toContain('places'); // Grupos derivados de las categorías del banco
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(QuickSortPage);
  });
});
