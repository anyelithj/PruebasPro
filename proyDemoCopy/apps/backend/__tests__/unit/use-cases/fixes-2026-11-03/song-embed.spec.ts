import { toEmbedUrl } from '../../../../src/modules/music/domain/media-links';
// [Suite 2026-11-03]: enlace de streaming → reproductor oficial embebido (el audio no se descarga)

describe('toEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://m.youtube.com/shorts/abcDEF12345', 'https://www.youtube-nocookie.com/embed/abcDEF12345'],
    ['https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC?si=x', 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'],
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://www.deezer.com/es/track/3135556', 'https://widget.deezer.com/widget/auto/track/3135556'],
  ])('%s', (raw, embed) => expect(toEmbedUrl(raw)).toBe(embed));

  it('sin reproductor conocido o enlace roto → null', () => {
    expect(toEmbedUrl('https://www.tiktok.com/@x/video/1')).toBeNull();
    expect(toEmbedUrl('https://www.youtube.com/')).toBeNull();
    expect(toEmbedUrl('no es un enlace')).toBeNull();
  });
});
