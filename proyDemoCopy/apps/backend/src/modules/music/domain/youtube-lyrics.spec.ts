import { captionsToLyrics, captionTracks, descriptionLyrics, pickTrack, youtubeVideoId } from './youtube-lyrics';

describe('youtube-lyrics', () => {
  it('extracts the video id', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://open.spotify.com/track/x')).toBeNull();
  });
  it('reads caption tracks and prefers the song language', () => {
    const html = 'x"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=1\u0026lang=en","languageCode":"en"},{"baseUrl":"https://www.youtube.com/api/timedtext?v=1\u0026lang=de","languageCode":"de","kind":"asr"}],"audioTracks":[]';
    const tracks = captionTracks(html);
    expect(tracks).toHaveLength(2);
    expect(pickTrack(tracks, 'de')?.baseUrl).toBe('https://www.youtube.com/api/timedtext?v=1&lang=de');
  });
  it('turns json3 captions into verses', () => {
    const json = JSON.stringify({ events: [{ segs: [{ utf8: '[Musik]' }] }, { segs: [{ utf8: 'Ich bin ' }, { utf8: 'Ana' }] }, { segs: [{ utf8: 'Ich bin Ana' }] }, { segs: [{ utf8: '♪ Du bist da ♪' }] }] });
    expect(captionsToLyrics(json)).toBe('Ich bin Ana\nDu bist da');
  });
  it('turns XML captions into verses', () => {
    expect(captionsToLyrics('<transcript><text start="1">I&#39;m here</text><text start="2">you &amp; me</text></transcript>')).toBe("I'm here\nyou & me");
  });
  it('finds lyrics in the description', () => {
    const desc = ['Kopf, Schulter, Knie und Fuß', 'Knie und Fuß', 'Augen, Ohren, Nase, Mund', 'Kopf, Schulter, Knie und Fuß', 'Knie und Fuß', 'Und noch einmal', 'https://instagram.com/x'].join('\n');
    const html = `"title":"Körperteile Lied","shortDescription":${JSON.stringify(desc)}`;
    const r = descriptionLyrics(html);
    expect(r.title).toBe('Körperteile Lied');
    expect(r.text).toContain('Augen, Ohren, Nase, Mund');
    expect(r.text).not.toContain('instagram');
  });
});

// [2026-11-06]: tiempos de cada verso desde los subtítulos del vídeo
import { captionCues, timeLyricLines } from './youtube-lyrics';
describe('timeLyricLines', () => {
  const json3 = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 9000, segs: [{ utf8: '[Música]' }] },
      { tStartMs: 9500, dDurationMs: 3000, segs: [{ utf8: 'is this the real life' }] },
      { tStartMs: 12800, dDurationMs: 3000, segs: [{ utf8: 'is this just fantasy' }] },
      { tStartMs: 16200, dDurationMs: 4000, segs: [{ utf8: 'caught in a landslide' }] },
    ],
  });
  it('cada verso empieza con su subtítulo (la intro instrumental no cuenta)', () => {
    const cues = captionCues(json3);
    expect(cues).toHaveLength(3);
    const t = timeLyricLines(['Is this the real life?', 'Is this just fantasy?', 'Caught in a landslide', 'Totally different words'], cues);
    expect(t.map((x) => x?.start ?? null)).toEqual([9.5, 12.8, 16.2, null]);
    expect(t[0]!.end).toBe(12.8);
  });
  it('XML timedtext <p t d> en milisegundos', () => {
    expect(captionCues('<timedtext><body><p t="1500" d="2000">Hello &amp; bye</p></body></timedtext>')).toEqual([{ start: 1.5, end: 3.5, text: 'Hello & bye' }]);
  });
});

// [2026-11-09]: LRCLIB (LRC) → la voz entra a los 38 s, no al 8 % de la duración
import { lrcCues } from './youtube-lyrics';
describe('lrcCues', () => {
  it('marcas LRC → frases con tiempo, ordenadas, sin líneas vacías', () => {
    const cues = lrcCues('[00:38.20] Le bien qui fait mal\n[00:00.00]\n[00:42.5] Je sais\r\n[01:02.00][00:45.00] Encore');
    expect(cues.map((c) => [c.start, c.text])).toEqual([[38.2, 'Le bien qui fait mal'], [42.5, 'Je sais'], [45, 'Encore'], [62, 'Encore']]);
    expect(cues[0]!.end).toBe(42.5);
    expect(timeLyricLines(['Le bien qui fait mal', 'Je sais'], cues)[0]!.start).toBe(38.2);
  });
});

// [2026-11-10]: la descripción con créditos del vídeo no es letra
describe('descriptionLyrics · créditos', () => {
  it('ignores video credits', () => {
    const desc = [
      'I Don’t Wanna Live Forever (Fifty Shades Darker) Official Video',
      'Song available on the Fifty Shades Darker Original Motion Picture Soundtrack',
      'Film In Theaters and Soundtrack Available 2.10.17',
      'Directed by Grant Singer', 'Produced by Saul Germaine', 'Executive Produced by Nina Soriano',
      'Director of Photography Steve Annis', 'Edited by Ari Tomasettig', 'For Anonymous Content x Somesuch',
    ].join('\n');
    const html = `"title":"x","shortDescription":${JSON.stringify(desc)}`;
    expect(descriptionLyrics(html).text).toBe('');
  });
});
