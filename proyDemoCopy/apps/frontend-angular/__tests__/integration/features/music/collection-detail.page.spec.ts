import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { MusicFacade } from '@features/music/application/music.facade';
import { MusicRepository } from '@features/music/domain/music.repository.port';
import { MusicHttpRepository } from '@features/music/infrastructure/music.http-repository';
import CollectionDetailPage from '@features/music/presentation/pages/collection-detail.page';
import { collection, sessionAs, song } from '@testing/music-dialogues';
// [Spec CollectionDetailPage · Sprint 9.8]: canciones en orden con enlace al reproductor; archivar solo autor o ADMIN; vacío y error | [Herramienta]: render() + setInput + msw

async function open(role: 'USER' | 'TEACHER', songs: unknown[] = [song()], status = 200) {
  server.use(
    http.get(`${API}/music/collections/c1`, () =>
      status === 200 ? HttpResponse.json(envelope({ ...collection, songs })) : HttpResponse.json({ message: 'Colección no encontrada' }, { status }),
    ),
  );
  const r = await render(CollectionDetailPage, [{ provide: MusicRepository, useClass: MusicHttpRepository }, MusicFacade, sessionAs(role)]);
  r.fixture.componentRef.setInput('id', 'c1');
  await settle(r.fixture);
  return r;
}

describe('CollectionDetailPage', () => {
  it('lista las canciones con enlace; el autor puede archivar', async () => {
    const { el } = await open('TEACHER');
    expect(el.textContent).toContain('Canciones infantiles'); // El encabezado de la página muestra el título (el emoji va en la tarjeta del hub)
    expect(el.querySelector('a[href="/musica/cancion/s1"]')).not.toBeNull();
    expect(getByRole(el, 'button', 'Archivar colección')).toBeTruthy();
  });

  it('estudiante sin archivar; colección vacía → mensaje', async () => {
    const { el } = await open('USER', []);
    expect(el.textContent).toContain('aún no tiene canciones publicadas');
    expect(el.textContent).not.toContain('Archivar');
  });

  it('404 → alerta', async () => {
    const { el } = await open('USER', [], 404);
    expect(getByRole(el, 'alert').textContent).toContain('no encontrada');
  });
});
