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
// [Spec SongUploadPage · Sprint 9.9 → 2026-11-13]: sin licencia válida no se guarda; borrador → enviar a revisión; ADMIN ve publicar/rechazar; letra sin IPA → aviso; rechazo con motivo visible | [Herramienta]: render() + setInput + msw

const providers = (role: 'TEACHER' | 'ADMIN') => [{ provide: MusicRepository, useClass: MusicHttpRepository }, MusicFacade, sessionAs(role)];

function type(el: HTMLElement, selector: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('SongUploadPage', () => {
  it('nueva canción: «Siguiente» deshabilitado hasta declarar la licencia', async () => {
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    expect(getByRole(el, 'button', 'Cancelar')).toBeTruthy(); // [2026-10-25]: el asistente se puede abandonar
    const save = getByRole(el, 'button', 'Siguiente') as HTMLButtonElement;
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

  it('[RF-148] nueva canción: no pide nivel (se estima de la letra) y lo indica', async () => {
    const { el } = await render(SongUploadPage, providers('TEACHER'));
    expect(el.textContent).toContain('se estima solo a partir de la letra');
    expect([...el.querySelectorAll('select option')].some((o) => o.textContent?.trim() === 'C2')).toBe(false); // Sin select de nivel al crear
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
    // [2026-10-25]: con la canción ya creada se abre directamente el paso 2 «Audio y letra»
    getByRole(el, 'button', 'Cargar letra').click();
    await settle(fixture);
    // [2026-10-24]: el servidor guardó la letra sin IPA ni traducción → aviso con la acción concreta para reintentar
    expect(el.textContent).toContain('El IPA y la traducción no se generaron'); // Indica reintentar con «Completar IPA y traducción»
    // [2026-11-10]: el último paso solo tiene Guardar (enviar a revisión/publicar se hace en Gestión)
    getByRole(el, 'button', 'Sincronización').click();
    await settle(fixture);
    expect(el.textContent).not.toContain('Enviar a revisión');
    expect(getByRole(el, 'button', 'Guardar')).toBeTruthy();
  });

  // [2026-10-31]: el audio es opcional · [2026-11-13]: el checklist salió del asistente (enviar a revisión y publicar viven en Gestión)
  it('sin audio: el último paso lo explica, ofrece Retirar y Guardar y NO «Enviar a revisión»', async () => {
    server.use(http.get(`${API}/music/songs/s1`, () => HttpResponse.json(envelope(songDetail({ status: 'draft', audioKey: null, editable: true, blockers: ['lyrics'] })))));
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    fixture.componentRef.setInput('id', 's1');
    await settle(fixture);
    expect(el.textContent).not.toContain('Antes de enviar a revisión'); // El checklist no estorba en los pasos 1-2
    getByRole(el, 'button', 'Sincronización').click();
    await settle(fixture);
    expect(el.textContent).not.toContain('Enviar a revisión');
    expect(el.textContent).toContain('aún no tiene audio');
    expect(getByRole(el, 'button', 'Retirar canción')).toBeTruthy();
    expect(getByRole(el, 'button', 'Guardar')).toBeTruthy();
  });

  it('versos sin traducción → «Completar IPA y traducción» reintenta solo lo que falta', async () => {
    let retried = false;
    // [TypeScript · fixture]: el verso 0 llega sin traducción (null en la API) → se pasa como override para no chocar con el tipo inferido (string)
    const base = songDetail({ status: 'draft', editable: true });
    const partial = { ...base, lines: base.lines.map((l, i) => ({ ...l, translation: i === 0 ? null : l.translation })) };
    server.use(
      http.get(`${API}/music/songs/s1`, () => HttpResponse.json(envelope(retried ? songDetail({ editable: true }) : partial))),
      http.post(`${API}/music/songs/s1/lines/enrich`, () => {
        retried = true;
        return HttpResponse.json(envelope({ lines: songDetail().lines, enriched: true, missing: 0 }));
      }),
    );
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    fixture.componentRef.setInput('id', 's1');
    await settle(fixture);
    expect(el.textContent).toContain('1 versos sin IPA o sin traducción');
    getByRole(el, 'button', 'Completar IPA y traducción').click();
    await settle(fixture);
    expect(retried).toBe(true);
    expect(el.textContent).not.toContain('sin IPA o sin traducción');
  });

  // [2026-11-13]: «letra con IA» salió del asistente de subida → sus pruebas se retiraron con la función
  it('enlace de letras en el campo del audio → aviso, UN solo botón «Importar enlace» y la letra aparece debajo sin subir audio', async () => {
    let audioPosted = false;
    server.use(
      http.get(`${API}/music/songs/s1`, () => HttpResponse.json(envelope(songDetail({ status: 'draft', audioKey: null, lines: [], editable: true })))),
      http.post(`${API}/music/songs/s1/audio/url`, () => {
        audioPosted = true;
        return HttpResponse.json(envelope(song()));
      }),
      http.post(`${API}/music/lyrics/from-url`, () => HttpResponse.json(envelope({ title: 'Flowers', text: 'We were good\nWe were gold', holder: '', strategy: 'site' }))),
    );
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    fixture.componentRef.setInput('id', 's1');
    await settle(fixture);
    type(el, 'input[type="url"]', 'https://www.letras.com/miley-cyrus/1426246/#letras:963935');
    await settle(fixture);
    const field = el.querySelector<HTMLInputElement>('input[type="url"]')!;
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('Página de letras: se importará la letra');
    // [2026-11-04]: SIEMPRE un único botón «Importar enlace»; el tipo de enlace decide qué se importa (aquí, solo la letra)
    expect(el.querySelector('aula-audio-uploader')!.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    getByRole(el, 'button', 'Importar enlace').click();
    await settle(fixture);
    expect(audioPosted).toBe(false);
    expect(el.querySelector<HTMLTextAreaElement>('textarea')!.value).toContain('We were gold');
    expect(el.textContent).toContain('Letra importada');
  });

  it('enlace de YouTube → se guarda su reproductor (POST del enlace); enlace directo .mp3 → también se envía', async () => {
    let posted: unknown;
    server.use(
      http.get(`${API}/music/songs/s1`, () => HttpResponse.json(envelope(songDetail({ status: 'draft', audioKey: null, editable: true })))),
      http.post(`${API}/music/songs/s1/audio/url`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(envelope(song()));
      }),
    );
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    fixture.componentRef.setInput('id', 's1');
    await settle(fixture);
    type(el, 'input[type="url"]', 'https://www.youtube.com/watch?v=abc');
    await settle(fixture);
    getByRole(el, 'button', 'Importar enlace').click();
    await settle(fixture);
    expect(posted).toEqual({ url: 'https://www.youtube.com/watch?v=abc' }); // NestJS decide: reproductor embebido
    type(el, 'input[type="url"]', 'https://cdn.example.com/flowers.mp3');
    await settle(fixture);
    getByRole(el, 'button', 'Importar enlace').click();
    await settle(fixture);
    expect(posted).toEqual({ url: 'https://cdn.example.com/flowers.mp3' });
  });
});
