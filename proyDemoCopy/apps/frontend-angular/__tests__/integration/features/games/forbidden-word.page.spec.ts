import { play, startFails } from '@testing/games';
import ForbiddenWordPage from '@features/games/presentation/pages/forbidden-word.page';
// [Spec ForbiddenWordPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('ForbiddenWordPage', () => {
  it('al empezar muestra el juego «Palabra prohibida»', async () => {
    const r = await play(ForbiddenWordPage, 'forbidden_word', 'Palabra prohibida', {});
    expect(r.el.textContent).toContain('No puedes decir');
    expect(r.el.textContent).toContain('fruit · red');
    expect(r.el.querySelector('textarea#agent-message')).not.toBeNull();
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(ForbiddenWordPage);
  });
});
