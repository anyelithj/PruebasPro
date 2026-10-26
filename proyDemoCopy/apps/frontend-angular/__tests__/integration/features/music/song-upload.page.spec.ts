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
    expect(el.textContent).toContain('no está disponible ahora');
    // «Enviar a revisión» vive en el último paso, junto a Guardar y Cancelar
    getByRole(el, 'button', 'Sincronización').click();
    await settle(fixture);
    expect(getByRole(el, 'button', 'Enviar a revisión')).toBeTruthy();
    expect(getByRole(el, 'button', 'Guardar')).toBeTruthy();
  });

  // [2026-10-24]: checklist de publicación — sin audio, «Enviar a revisión» deshabilitado y explicado (antes: 400 «Falta subir el audio» del servidor)
  it('sin audio: el último paso muestra qué falta y NO ofrece «Enviar a revisión»', async () => {
    server.use(http.get(`${API}/music/songs/s1`, () => HttpResponse.json(envelope(songDetail({ status: 'draft', audioKey: null, editable: true, blockers: ['audio'] })))));
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    fixture.componentRef.setInput('id', 's1');
    await settle(fixture);
    expect(el.textContent).not.toContain('Antes de enviar a revisión'); // El checklist no estorba en los pasos 1-2
    getByRole(el, 'button', 'Sincronización').click();
    await settle(fixture);
    expect(el.textContent).not.toContain('Enviar a revisión');
    expect(el.textContent).toContain('Audio subido');
    expect(el.textContent).toContain('Completa lo que falta');
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

  it('letra con IA: usa el título y el autor como tema (sin campo «tema») y rellena la letra para revisar', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/music/lyrics/draft`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ title: 'Morning Song', lyrics: 'I wake up\nI brush my teeth', lines: 2, model: 'aya' }));
      }),
    );
    const { fixture, el } = await render(SongUploadPage, providers('TEACHER'));
    expect(el.querySelector('input[maxlength="200"]')).toBeNull();
    type(el, 'input[maxlength="160"]', 'Morning Song');
    await settle(fixture);
    getByRole(el, 'button', 'Generar letra').click();
    await settle(fixture);
    expect(body).toMatchObject({ topic: 'Morning Song', title: 'Morning Song', language: 'en' });
    expect(el.querySelector<HTMLTextAreaElement>('textarea')!.value).toContain('I brush my teeth');
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
    getByRole(el, 'button', 'Sincronización').click();
    await settle(fixture);
    expect((getByRole(el, 'button', 'Rechazar') as HTMLButtonElement).disabled).toBe(true); // Sin motivo no se rechaza
    getByRole(el, 'button', 'Publicar').click();
    await settle(fixture);
    expect(decision).toEqual({ status: 'published' });
  });
  // [2026-10-24 · Enlace del audio]: página de letras pegada en «enlace directo del audio» → NO se envía el POST (sin 400 en la consola) y se ofrece importar la letra
  it('enlace de letras en el campo del audio → UN solo botón «Importar la letra desde este enlace» y la letra aparece debajo', async () => {
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
    expect(el.textContent).toContain('Esto es una página de letras');
    expect(el.textContent).not.toContain('Importar enlace'); // [2026-10-25]: el botón del enlace cambia de acción (no se duplica)
    getByRole(el, 'button', 'Importar la letra desde este enlace').click();
    await settle(fixture);
    expect(audioPosted).toBe(false);
    expect(el.querySelector<HTMLTextAreaElement>('textarea')!.value).toContain('We were gold');
    expect(el.textContent).toContain('Letra importada');
  });

  it('enlace de YouTube → explicación clara y sin POST; enlace directo .mp3 → sí se envía', async () => {
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
    expect(el.textContent).toContain('plataformas de streaming no permiten importar');
    getByRole(el, 'button', 'Importar enlace').click();
    await settle(fixture);
    expect(posted).toBeUndefined();
    type(el, 'input[type="url"]', 'https://cdn.example.com/flowers.mp3');
    await settle(fixture);
    getByRole(el, 'button', 'Importar enlace').click();
    await settle(fixture);
    expect(posted).toEqual({ url: 'https://cdn.example.com/flowers.mp3' });
  });
});
