import {
  decodeBody,
  extractLyrics,
  innerOf,
  longestVerseRun,
  plainLyrics,
} from '../../../src/modules/music/domain/lyrics-text';
// [Pruebas LyricsText · 2026-10-24]: extractor de letras desde HTML (sitios conocidos, genérico y último recurso) + charset | [Patrón]: AAA (Arrange-Act-Assert) con HTML mínimo

const VERSES = ['Hello, it is me', 'I was wondering', 'If after all these years', 'You would like to meet'];

describe('lyrics-text', () => {
  it('Genius: une varios contenedores y quita la cabecera «Contributors»', () => {
    const html = `<html><head><meta property="og:title" content="Song &amp; Title | Genius"></head><body>
      <div data-lyrics-container="true" class="Lyrics__Container"><div data-exclude-from-selection="true">23 Contributors</div>[Verse 1]<br>${VERSES[0]}<br>${VERSES[1]}</div>
      <div class="ad">Anuncio</div>
      <div data-lyrics-container="true"><a href="#">${VERSES[2]}</a><br><i>${VERSES[3]}</i></div></body></html>`;
    const out = extractLyrics(html);
    expect(out.strategy).toBe('site');
    expect(out.title).toBe('Song & Title');
    expect(out.text.split('\n').filter(Boolean)).toEqual(VERSES);
  });

  it('Letras: estrofas en <p> separadas por una línea vacía', () => {
    const html = `<div class="lyric-original"><p>${VERSES[0]}<br>${VERSES[1]}</p><p>${VERSES[2]}<br>${VERSES[3]}</p></div>`;
    expect(extractLyrics(html).text).toBe(`${VERSES[0]}\n${VERSES[1]}\n\n${VERSES[2]}\n${VERSES[3]}`);
  });

  it('AZLyrics: la letra tras el comentario fijo', () => {
    const html = `<div class="col"><!-- Usage of azlyrics.com content by any third-party lyrics provider is prohibited. -->\n${VERSES.join('<br>\n')}</div>`;
    expect(extractLyrics(html).text.split('\n')).toEqual(VERSES);
  });

  it('Lyrics.com: <pre> conserva sus saltos de línea', () => {
    expect(extractLyrics(`<pre id="lyric-body-text" class="lyric-body">${VERSES.join('\n')}</pre>`).text.split('\n')).toEqual(VERSES);
  });

  it('genérico: bloque con «letra» en la clase', () => {
    const html = `<nav>Inicio | Buscar</nav><section class="cancion-letra">${VERSES.map((v) => `<span>${v}</span><br/>`).join('')}</section>`;
    expect(extractLyrics(html)).toMatchObject({ strategy: 'generic' });
  });

  it('último recurso: el tramo más largo de líneas cortas del <main>', () => {
    const html = `<body><header>Menú</header><main><h1>Mi canción</h1><p>Esta es una descripción muy larga del artículo que no forma parte de la letra porque supera con creces los noventa caracteres permitidos.</p><p>${VERSES.join('<br>')}</p></main><footer>© 2026</footer></body>`;
    expect(extractLyrics(html).text).toContain(VERSES.join('\n'));
  });

  it('sin versos → error accionable', () => {
    expect(() => extractLyrics('<p>Hola</p>')).toThrow(/pégala/);
  });

  it('innerOf respeta divs anidados', () => {
    const html = '<div id="a"><div>x</div>y</div>z';
    expect(innerOf(html, 0)).toEqual({ inner: '<div>x</div>y', end: html.length - 1 });
  });

  it('decodeBody usa el charset de la cabecera o del <meta>', () => {
    const latin1 = Buffer.from('<meta charset="iso-8859-1"><p>Canción</p>', 'latin1');
    expect(decodeBody(latin1, 'text/html')).toContain('Canción');
    expect(decodeBody(Buffer.from('Ñandú', 'latin1'), 'text/plain; charset=windows-1252')).toBe('Ñandú');
    expect(decodeBody(Buffer.from('Ñandú', 'utf-8'), 'text/plain')).toBe('Ñandú');
  });

  it('plainLyrics quita marcas de tiempo LRC', () => {
    expect(plainLyrics('[00:12.30] Hello\n[00:15.00] World').text).toBe('Hello\nWorld');
  });

  it('longestVerseRun ignora avisos legales y URL', () => {
    expect(longestVerseRun(['Copyright 2026', ...VERSES, 'https://x.y'].join('\n'))).toBe(VERSES.join('\n'));
  });
});
