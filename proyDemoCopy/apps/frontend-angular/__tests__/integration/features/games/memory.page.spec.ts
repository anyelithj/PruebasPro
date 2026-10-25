import { play, startFails } from '@testing/games';
import MemoryPage from '@features/games/presentation/pages/memory.page';
// [Spec MemoryPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('MemoryPage', () => {
  it('al empezar muestra el juego «Parejas»', async () => {
    const r = await play(MemoryPage, 'memory', 'Parejas', {});
    expect(r.el.querySelectorAll('button[aria-pressed]').length).toBe(6); // 3 palabras → 6 cartas
    expect(r.el.textContent).toContain('Parejas por encontrar: 3');
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(MemoryPage);
  });
});
