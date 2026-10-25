import { play, startFails } from '@testing/games';
import PartialDictationPage from '@features/games/presentation/pages/partial-dictation.page';
// [Spec PartialDictationPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('PartialDictationPage', () => {
  it('al empezar muestra el juego «Dictado parcial»', async () => {
    const r = await play(PartialDictationPage, 'partial_dictation', 'Dictado parcial', {});
    expect(r.el.textContent).toContain('I take the _____ to work'); // Hueco oculto
    expect(r.el.textContent).toContain('Escribe la palabra que falta');
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(PartialDictationPage);
  });
});
