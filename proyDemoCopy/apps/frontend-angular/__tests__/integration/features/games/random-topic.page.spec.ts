import { play, startFails } from '@testing/games';
import RandomTopicPage from '@features/games/presentation/pages/random-topic.page';
// [Spec RandomTopicPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('RandomTopicPage', () => {
  it('al empezar muestra el juego «Tema al azar»', async () => {
    const r = await play(RandomTopicPage, 'random_topic', 'Tema al azar', {});
    expect(r.el.textContent).toContain('Remote work is the future');
    expect(r.el.textContent).toContain('Grabar');
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(RandomTopicPage);
  });
});
