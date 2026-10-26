import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { LyricsImportService } from '@features/music/infrastructure/lyrics-import.service';
// [Spec LyricsImportService · 2026-10-24]: el enlace de una letra va primero al extractor de NestJS; si no es una página de texto (415) se usa el extractor general de Next.js; otros errores llegan con su mensaje | [Herramienta]: msw 2

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), LyricsImportService] });
  return TestBed.inject(LyricsImportService);
}

describe('LyricsImportService', () => {
  it('página de letras → NestJS /music/lyrics/from-url', async () => {
    server.use(http.post(`${API}/music/lyrics/from-url`, () => HttpResponse.json(envelope({ title: 'Song', text: 'a\nb', holder: '', strategy: 'site' }))));
    expect(await setup().fromUrl('https://letras.example/x', 'en')).toEqual({ title: 'Song', text: 'a\nb', holder: '' });
  });

  it('PDF (415) → extractor general de Next.js', async () => {
    server.use(
      http.post(`${API}/music/lyrics/from-url`, () => HttpResponse.json({ statusCode: 415, message: 'No es texto' }, { status: 415 })),
      http.post(`${API}/media/extract-text`, () => HttpResponse.json({ title: 'pdf', text: 'desde pdf', holder: '' })),
    );
    expect((await setup().fromUrl('https://x.example/a.pdf', 'en')).text).toBe('desde pdf');
  });

  it('sitio con anti-bots → error con el mensaje accionable del servidor', async () => {
    server.use(http.post(`${API}/music/lyrics/from-url`, () => HttpResponse.json({ statusCode: 422, message: 'Copia la letra y pégala' }, { status: 422 })));
    await expect(setup().fromUrl('https://genius.example/x', 'en')).rejects.toThrow('Copia la letra y pégala');
  });
});
