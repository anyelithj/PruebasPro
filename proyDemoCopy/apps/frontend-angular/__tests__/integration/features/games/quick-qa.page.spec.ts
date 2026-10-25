import { play, startFails } from '@testing/games';
import QuickQaPage from '@features/games/presentation/pages/quick-qa.page';
// [Spec QuickQaPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('QuickQaPage', () => {
  it('al empezar muestra el juego «Pregunta-respuesta rápida»', async () => {
    const r = await play(QuickQaPage, 'quick_qa', 'Pregunta-respuesta rápida', {});
    expect(r.el.querySelector('[role="timer"]')).not.toBeNull(); // Tiempo hasta responder visible
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(QuickQaPage);
  });
});
