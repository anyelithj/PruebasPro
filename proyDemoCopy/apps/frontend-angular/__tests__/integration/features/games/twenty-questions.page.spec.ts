import { play, startFails } from '@testing/games';
import TwentyQuestionsPage from '@features/games/presentation/pages/twenty-questions.page';
// [Spec TwentyQuestionsPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('TwentyQuestionsPage', () => {
  it('al empezar muestra el juego «20 preguntas»', async () => {
    const r = await play(TwentyQuestionsPage, 'twenty_questions', '20 preguntas', { target: null, forbidden: [] });
    expect(r.el.textContent).toContain('preguntas de sí o no'); // Instrucciones como primer turno del agente
    expect(r.el.textContent).not.toContain('apple'); // El secreto no se muestra
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(TwentyQuestionsPage);
  });
});
