import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { MusicFacade } from '@features/music/application/music.facade';
import { MusicRepository } from '@features/music/domain/music.repository.port';
import { MusicHttpRepository } from '@features/music/infrastructure/music.http-repository';
import MusicHubPage from '@features/music/presentation/pages/music-hub.page';
import { collection, sessionAs, song } from '@testing/music-dialogues';
// [Spec MusicHubPage · Sprint 9.8]: colecciones y canciones con licencia visible; subir solo para docentes; cola de revisión solo para el ADMIN; vacío y error | [Herramienta]: render() + sesión falsa + msw

const providers = (role: 'USER' | 'TEACHER' | 'ADMIN') => [{ provide: MusicRepository, useClass: MusicHttpRepository }, MusicFacade, sessionAs(role)];

function api(collections: unknown[] = [collection]) {
  server.use(
    http.get(`${API}/music/collections`, () => HttpResponse.json(envelope(collections))),
    http.get(`${API}/music/songs`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      if (p.get('status') === 'review') return HttpResponse.json(envelope([song({ id: 's9', title: 'Pendiente', status: 'review' })]));
      return HttpResponse.json(envelope([song()]));
    }),
  );
}

describe('MusicHubPage', () => {
  it('estudiante: colecciones, canciones con licencia y sin acciones de docente', async () => {
    api();
    const { el } = await render(MusicHubPage, providers('USER'));
    expect(el.textContent).toContain('Canciones infantiles');
    expect(el.textContent).toContain('Licencia: Creative Commons · Aula de Idiomas');
    expect(el.querySelector('a[href="/musica/coleccion/c1"]')).not.toBeNull();
    expect(el.querySelector('a[href="/musica/subir"]')).toBeNull();
    expect(el.textContent).not.toContain('Pendientes de revisión');
  });

  it('ADMIN: subir y cola de revisión con publicar y rechazar', async () => {
    api();
    const { el } = await render(MusicHubPage, providers('ADMIN'));
    expect(el.querySelector('a[href="/musica/subir"]')).not.toBeNull();
    expect(el.textContent).toContain('Pendiente');
    expect(getByRole(el, 'button', 'Publicar')).toBeTruthy();
  });

  it('sin colecciones → mensaje; error → alerta', async () => {
    api([]);
    const { el } = await render(MusicHubPage, providers('USER'));
    expect(el.textContent).toContain('Aún no hay colecciones');
  });

  it('error del backend → alerta', async () => {
    server.use(http.get(`${API}/music/collections`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })), http.get(`${API}/music/songs`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(MusicHubPage, providers('USER'));
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
