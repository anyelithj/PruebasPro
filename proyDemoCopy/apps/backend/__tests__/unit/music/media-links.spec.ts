import { BadRequestException } from '@nestjs/common';
import { fetchMediaUrl } from '../../../src/modules/music/application/use-cases/upload-song-audio.use-case';
import {
  classifyMediaLink,
  MEDIA_LINK_MESSAGES,
} from '../../../src/modules/music/domain/media-links';
// [Pruebas MediaLinks · 2026-10-24]: clasificación del enlace del audio (letras / streaming / directo) y Fail Fast de «subir audio por URL» sin petición saliente | [Patrón]: AAA + Test Double (jest.spyOn sobre fetch global)

describe('media-links', () => {
  it.each([
    ['https://www.letras.com/miley-cyrus/1426246/#letras:963935', 'lyrics_page'],
    ['https://genius.com/Adele-hello-lyrics', 'lyrics_page'],
    ['https://www.azlyrics.com/lyrics/adele/hello.html', 'lyrics_page'],
    ['https://www.youtube.com/watch?v=abc', 'streaming_page'],
    ['https://youtu.be/abc', 'streaming_page'],
    ['https://open.spotify.com/track/1', 'streaming_page'],
    ['https://cdn.example.com/hello.mp3', 'direct'],
    ['https://notgenius.com/a.mp3', 'direct'], // Subdominio sí, sufijo arbitrario no
    ['ftp://example.com/a.mp3', 'invalid'],
    ['no es un enlace', 'invalid'],
  ])('%s → %s', (url, kind) => {
    expect(classifyMediaLink(url)).toBe(kind);
  });

  it('fetchMediaUrl: página de letras → 400 accionable SIN descargar', async () => {
    const spy = jest.spyOn(global, 'fetch');
    await expect(fetchMediaUrl('https://www.letras.com/miley-cyrus/1426246/')).rejects.toThrow(
      new BadRequestException(MEDIA_LINK_MESSAGES.lyrics_page),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('fetchMediaUrl: YouTube → 400 que explica que el streaming no se importa', async () => {
    await expect(fetchMediaUrl('https://www.youtube.com/watch?v=abc')).rejects.toThrow(MEDIA_LINK_MESSAGES.streaming_page);
  });
});
