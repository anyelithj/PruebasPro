import { play, startFails } from '@testing/games';
import TabooPage from '@features/games/presentation/pages/taboo.page';
// [Spec TabooPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('TabooPage', () => {
  it('al empezar muestra el juego «Tabú»', async () => {
    const r = await play(TabooPage, 'taboo', 'Tabú', {});
    expect(r.el.textContent).toContain('apple');
    expect(r.el.textContent).toContain('Grabar'); // Tabú admite voz
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(TabooPage);
  });
});
