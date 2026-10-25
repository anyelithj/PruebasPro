import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { MusicFacade } from '@features/music/application/music.facade';
import { MusicRepository } from '@features/music/domain/music.repository.port';
import { MusicHttpRepository } from '@features/music/infrastructure/music.http-repository';
import SongPlayerPage from '@features/music/presentation/pages/song-player.page';
import { sessionAs, songDetail } from '@testing/music-dialogues';
// [Spec SongPlayerPage · Sprints 9.7/9.8]: avatar con estado en texto, letra con IPA (lang -fonipa) y traducción lado a lado, interruptor UK/US en inglés, controles y acceso a prácticas; sin audio → aviso; error → alerta | [Herramienta]: render() + setInput + msw

// [jsdom]: HTMLMediaElement no reproduce → play/pause falsos (la lógica del reproductor se prueba en la fachada)
beforeAll(() => {
  HTMLMediaElement.prototype.pause = jest.fn();
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});

async function open(detail: unknown, status = 200) {
  server.use(http.get(`${API}/music/songs/s1`, () => (status === 200 ? HttpResponse.json(envelope(detail)) : HttpResponse.json({ message: 'Canción no encontrada' }, { status }))));
  const r = await render(SongPlayerPage, [{ provide: MusicRepository, useClass: MusicHttpRepository }, MusicFacade, sessionAs('USER')]);
  r.fixture.componentRef.setInput('id', 's1');
  await settle(r.fixture);
  return r;
}

describe('SongPlayerPage', () => {
  it('karaoke: avatar, letra bilingüe con IPA, UK/US y prácticas', async () => {
    const { el } = await open(songDetail());
    expect(el.textContent).toContain('En reposo'); // Estado del avatar en texto
    expect(el.textContent).toContain('Twinkle, twinkle, little star');
    expect(el.textContent).toContain('traducción 0');
    expect(el.querySelector('[lang="en-fonipa"]')?.textContent).toContain('/ipa-');
    expect(el.querySelector('[role="switch"]')).not.toBeNull(); // Interruptor UK/US (inglés)
    expect(getByRole(el, 'button', 'Reproducir')).toBeTruthy();
    expect(el.querySelector('a[href="/musica/cancion/s1/practica"]')).not.toBeNull();
  });

  it('canción en español: sin columna de traducción ni interruptor', async () => {
    const { el } = await open(songDetail({ language: 'es' }));
    expect(el.textContent).not.toContain('Traducción al español');
    expect(el.querySelector('[role="switch"]')).toBeNull();
  });

  it('sin audio → aviso; 404 → alerta', async () => {
    expect((await open(songDetail({ audioKey: null }))).el.textContent).toContain('aún no tiene audio');
  });

  it('error → alerta', async () => {
    const { el } = await open(null, 404);
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
