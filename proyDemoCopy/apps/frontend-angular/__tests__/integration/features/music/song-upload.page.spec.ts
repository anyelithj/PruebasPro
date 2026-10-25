import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { MusicFacade } from '@features/music/application/music.facade';
import { MusicRepository } from '@features/music/domain/music.repository.port';
import { MusicHttpRepository } from '@features/music/infrastructure/music.http-repository';
import SongUploadPage from '@features/music/presentation/pages/song-upload.page';
import { sessionAs, song, songDetail } from '@testing/music-dialogues';
// [Spec SongUploadPage · Sprint 9.9]: sin licencia válida no se guarda; borrador → enviar a revisión; ADMIN ve publicar/rechazar; letra sin IPA → aviso; rechazo con motivo visible | [Herramienta]: render() + setInput + msw

const providers = (role: 'TEACHER' | 'ADMIN') => [{ provide: MusicRepository, useClass: MusicHttpRepository }, MusicFacade, sessionAs(role)];

function type(el: HTMLElement, selector: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('SongUploadPage', () => {
  it('nueva canción: «Guardar» deshabilitado hasta declarar la licencia', async () => {
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    const save = getByRole(el, 'button', 'Guardar datos') as HTMLButtonElement;
    type(el, 'input[maxlength="160"]', 'Mi canción');
    await settle(fixture);
    expect(save.disabled).toBe(true);
    expect(el.textContent).toContain('Indica el titular de los derechos');
    type(el, 'fieldset input[maxlength="160"]', 'Aula de Idiomas');
    const confirm = el.querySelector<HTMLInputElement>('fieldset input[type="checkbox"]')!;
    confirm.checked = true;
    confirm.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(save.disabled).toBe(false);
  });

  it('borrador rechazado: motivo visible y «Enviar a revisión»; letra sin IPA → aviso', async () => {
    server.use(
      http.get(`${API}/music/songs/s1`, () => HttpResponse.json(envelope(songDetail({ status: 'rejected', reviewNote: 'Falta permiso', editable: true })))),
      http.post(`${API}/music/songs/s1/lines`, () => HttpResponse.json(envelope({ lines: [], enriched: false }), { status: 201 })),
    );
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    fixture.componentRef.setInput('id', 's1');
    await settle(fixture);
    expect(el.textContent).toContain('Rechazada: Falta permiso');
    expect(getByRole(el, 'button', 'Enviar a revisión')).toBeTruthy();
    getByRole(el, 'button', 'Letra con IPA').click();
    await settle(fixture);
    getByRole(el, 'button', 'Cargar letra').click();
    await settle(fixture);
    expect(el.textContent).toContain('no respondió');
  });

  it('ADMIN con canción en revisión: publicar y rechazar (con motivo)', async () => {
    let decision: unknown;
    server.use(
      http.get(`${API}/music/songs/s1`, () => HttpResponse.json(envelope(songDetail({ status: 'review', editable: true })))),
      http.patch(`${API}/music/songs/s1/status`, async ({ request }) => {
        decision = await request.json();
        return HttpResponse.json(envelope(song()));
      }),
    );
    const { fixture, el } = await render(SongUploadPage, providers('ADMIN'));
    fixture.componentRef.setInput('id', 's1');
    await settle(fixture);
    expect((getByRole(el, 'button', 'Rechazar') as HTMLButtonElement).disabled).toBe(true); // Sin motivo no se rechaza
    getByRole(el, 'button', 'Publicar').click();
    await settle(fixture);
    expect(decision).toEqual({ status: 'published' });
  });
});
