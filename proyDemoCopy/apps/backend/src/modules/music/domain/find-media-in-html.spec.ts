import { findMediaInHtml } from './media-links';

describe('findMediaInHtml', () => {
  const base = 'https://blog.example.com/canciones/mi-cancion';
  it('prefers a direct audio file (relative src resolved)', () => {
    expect(findMediaInHtml('<audio controls><source src="/media/song.mp3" type="audio/mpeg"></audio>', base)).toBe('https://blog.example.com/media/song.mp3');
  });
  it('reads og:audio', () => {
    expect(findMediaInHtml('<meta property="og:audio" content="https://cdn.example.com/a.m4a?x=1">', base)).toBe('https://cdn.example.com/a.m4a?x=1');
  });
  it('turns an embedded YouTube iframe into its watch page', () => {
    expect(findMediaInHtml('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>', base)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
  it('turns a Spotify embed into its track page', () => {
    expect(findMediaInHtml('<iframe src="https://open.spotify.com/embed/track/abc123"></iframe>', base)).toBe('https://open.spotify.com/track/abc123');
  });
  it('returns null when the page has no media', () => {
    expect(findMediaInHtml('<p>Hola</p><a href="/contacto">x</a>', base)).toBeNull();
  });
});
