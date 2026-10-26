// [LyricsText · Dominio · 2026-10-24]: bytes de una página → texto de la letra (un verso por línea, estrofas separadas por una línea vacía)
// [Estrategias en orden]: 1) contenedores conocidos de sitios de letras (Genius, AZLyrics, Letras, Lyrics.com, Songtexte…) · 2) cualquier bloque con «lyric/letra/paroles/songtext» en id o class · 3) el tramo más largo de líneas cortas del texto principal (así se ve una letra)
// [Patrón]: Strategy (cadena de extractores) + Chain of Responsibility (el primero que encuentra letra gana) | [Principio]: SRP + determinístico (sin LLM ni dependencias: expresiones regulares y un contador de profundidad) | [Paradigma]: Funcional (todas puras → testeables)

export interface ExtractedLyrics {
  title: string;
  text: string;
  holder: string; // Siempre '' (la licencia la declara el docente); mismo contrato que /api/media/extract-text de Next.js
  strategy: 'site' | 'generic' | 'plain';
}

const MAX_TEXT = 12_000; // Igual que LyricsBody (@MaxLength) → lo importado siempre se puede guardar
const MIN_LINES = 4; // Menos versos no parece una letra

// [decodeBody]: Buffer → string con el charset correcto (cabecera → BOM → <meta charset> → UTF-8) | `TextDecoder` (WHATWG, Node con ICU completo): windows-1252, iso-8859-1, shift_jis, gbk, koi8-r…
export function decodeBody(body: Buffer, contentType: string): string {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  const bom =
    body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf ? 'utf-8'
    : body[0] === 0xff && body[1] === 0xfe ? 'utf-16le'
    : body[0] === 0xfe && body[1] === 0xff ? 'utf-16be'
    : undefined;
  const head = body.subarray(0, 4096).toString('latin1'); // `latin1`: 1 byte = 1 carácter → sirve para buscar la etiqueta <meta>
  const fromMeta =
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  for (const label of [bom, fromHeader, fromMeta, 'utf-8']) {
    if (!label) continue;
    try {
      return new TextDecoder(label.toLowerCase()).decode(body); // Lanza RangeError si la etiqueta no existe → se prueba la siguiente
    } catch {
      /* etiqueta desconocida: siguiente candidata */
    }
  }
  return body.toString('utf-8');
}

// [Entidades HTML]: las habituales por nombre + todas las numéricas | `Readonly<Record<…>>` (TS): tabla inmutable
const NAMED: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', ndash: '–', mdash: '—', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', ntilde: 'ñ', Ntilde: 'Ñ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  uuml: 'ü', Uuml: 'Ü', ouml: 'ö', Ouml: 'Ö', auml: 'ä', Auml: 'Ä', szlig: 'ß', ccedil: 'ç', Ccedil: 'Ç', egrave: 'è', agrave: 'à', ecirc: 'ê', ocirc: 'ô', atilde: 'ã', otilde: 'õ',
};
export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m; // `fromCodePoint` (ES2015): también emojis/astrales
    }
    return NAMED[e] ?? m;
  });

// [innerOf]: HTML interno del elemento cuya etiqueta de apertura empieza en `start` (cuenta aperturas y cierres del mismo nombre) | Función pura
export function innerOf(html: string, start: number): { inner: string; end: number } | null {
  const open = /^<([a-z][\w-]*)\b[^>]*>/i.exec(html.slice(start));
  if (!open) return null;
  const tag = open[1]!.toLowerCase();
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi'); // `RegExp` dinámica: solo etiquetas de ese nombre
  re.lastIndex = start + open[0].length;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[2]) continue; // <div/> autocerrada
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { inner: html.slice(start + open[0].length, m.index), end: m.index + m[0].length };
  }
  return null; // HTML mal cerrado: el llamador prueba otra estrategia
}

// [removeElements]: quita del HTML cada elemento cuya apertura coincide con `opening` (con su contenido anidado) | Función pura
export function removeElements(html: string, opening: RegExp): string {
  let out = html;
  const re = new RegExp(opening.source, opening.flags.includes('i') ? 'i' : ''); // Sin `g`: siempre la primera aparición restante
  for (let guard = 0, m = re.exec(out); m && guard < 200; guard++, m = re.exec(out)) {
    const found = innerOf(out, m.index);
    out = out.slice(0, m.index) + (found ? out.slice(found.end) : out.slice(m.index + m[0].length));
  }
  return out;
}

// [htmlToText]: HTML → texto con saltos de línea donde el navegador los pinta (br, párrafos, bloques) | Función pura
// Como el navegador: los saltos del CÓDIGO fuente son espacios (salvo dentro de <pre> o si `pre` = el contenedor ya era un <pre>)
export function htmlToText(html: string, pre = false): string {
  const keepPre = (s: string) => s.replace(/\r?\n/g, '<br>');
  return decodeEntities(
    (pre ? keepPre(html) : html.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => keepPre(inner)))
      .replace(/\s+/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|noscript|svg|template|iframe|button|select|textarea)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n') // Párrafo = estrofa en la mayoría de sitios
      .replace(/<\/(div|li|h[1-6]|tr|section|article|pre|blockquote|header|footer|ul|ol|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

// [tidy]: espacios normalizados, sin etiquetas de sección («[Chorus]», «[Estribillo x2]»), máximo una línea vacía seguida | Función pura
export function tidy(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter((l) => !/^\[[^\]]{1,40}\]$/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT);
}

const lineCount = (t: string): number => t.split('\n').filter((l) => l.trim()).length;

// [SITE_CONTAINERS]: aperturas de los contenedores de letra conocidos (se concatenan todos los que aparezcan: Genius parte la letra en varios)
const SITE_CONTAINERS: readonly RegExp[] = [
  /<div[^>]+data-lyrics-container="true"[^>]*>/gi, // Genius
  /<div[^>]+class="[^"]*\blyric-original\b[^"]*"[^>]*>/gi, // Letras.mus.br / Letras.com
  /<div[^>]+class="[^"]*\bcnt-letra\b[^"]*"[^>]*>/gi, // Letras (diseño anterior)
  /<pre[^>]+id="lyric-body-text"[^>]*>/gi, // Lyrics.com
  /<div[^>]+id="song-body"[^>]*>/gi, // LyricsTranslate
  /<div[^>]+id="lyrics"[^>]*>/gi, // Songtexte y otros
  /<div[^>]+class="[^"]*\bsongtext\b[^"]*"[^>]*>/gi, // Songtexte.com
];
// [Genérico]: id o class con lyric(s) / letra / paroles / songtext / liedtext / tekst
const GENERIC_CONTAINER =
  /<(div|section|article|pre|p)[^>]+(?:id|class)="[^"]*\b(?:lyrics?|letra|paroles|songtext|liedtext|tekst)[\w-]*\b[^"]*"[^>]*>/gi;
// [Ruido dentro del contenedor]: cabeceras «23 Contributors», anuncios, botones de compartir
const NOISE = /<(div|span|aside)[^>]+(?:data-exclude-from-selection="true"|class="[^"]*\b(?:LyricsHeader|ad|ads|share|RightSidebar)[\w-]*\b[^"]*")[^>]*>/i;

// [fromContainers]: une el texto de todos los contenedores que coinciden | '' si ninguno tiene suficientes versos
function fromContainers(html: string, opening: RegExp): string {
  const parts: string[] = [];
  let lastEnd = -1; // Un contenedor anidado dentro de otro ya leído no se repite
  for (const m of html.matchAll(opening)) {
    if (m.index < lastEnd) continue;
    const found = innerOf(html, m.index);
    if (!found) continue;
    parts.push(htmlToText(removeElements(found.inner, NOISE), /^<pre\b/i.test(m[0])));
    lastEnd = found.end;
  }
  const text = tidy(parts.join('\n\n'));
  return lineCount(text) >= MIN_LINES ? text : '';
}

// [AZLyrics]: la letra va justo después de un comentario fijo y sin id/class propios
function fromAzLyrics(html: string): string {
  const m = /<!--\s*Usage of azlyrics\.com content[\s\S]*?-->([\s\S]*?)<\/div>/i.exec(html);
  return m ? tidy(htmlToText(m[1]!)) : '';
}

// [longestVerseRun]: el tramo más largo de líneas «de canción» (cortas, sin URL ni avisos legales) permitiendo una línea vacía entre estrofas | Función pura
export function longestVerseRun(text: string): string {
  const lines = text.split('\n');
  const verse = (l: string) => l.length >= 1 && l.length <= 90 && !/https?:\/\/|©|cookies?|copyright|\|/i.test(l);
  let best: string[] = [];
  let cur: string[] = [];
  let blanks = 0;
  const close = () => {
    if (lineCount(cur.join('\n')) > lineCount(best.join('\n'))) best = cur;
    cur = [];
  };
  for (const l of lines) {
    if (!l) {
      if (++blanks > 1) close(); // Dos líneas vacías seguidas = fin del bloque
      else if (cur.length) cur.push('');
      continue;
    }
    blanks = 0;
    if (verse(l)) cur.push(l);
    else close();
  }
  close();
  return tidy(best.join('\n'));
}

// [pageTitle]: og:title o <title> (sin el sufijo « | Sitio») | Función pura
export function pageTitle(html: string): string {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1];
  const title = og ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  return decodeEntities(title).replace(/\s+/g, ' ').split(/\s[|–—]\s/)[0]!.trim().slice(0, 160);
}

// [extractLyrics]: HTML completo → letra + título | lanza Error con mensaje accionable si no encuentra versos
export function extractLyrics(html: string): ExtractedLyrics {
  const title = pageTitle(html);
  const site = SITE_CONTAINERS.map((re) => fromContainers(html, re)).find(Boolean) || fromAzLyrics(html);
  if (site && lineCount(site) >= MIN_LINES) return { title, text: site, holder: '', strategy: 'site' };
  const generic = fromContainers(html, GENERIC_CONTAINER);
  if (generic) return { title, text: generic, holder: '', strategy: 'generic' };
  // [Último recurso]: texto principal (main/article o body sin navegación) → tramo de versos más largo
  const main =
    /<(main|article)\b[^>]*>/i.exec(html) ?? /<body\b[^>]*>/i.exec(html);
  const scope = main ? (innerOf(html, main.index)?.inner ?? html) : html;
  const cleaned = removeElements(scope, /<(nav|header|footer|aside|form)\b[^>]*>/i);
  const run = longestVerseRun(htmlToText(cleaned).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).join('\n'));
  if (lineCount(run) >= MIN_LINES) return { title, text: run, holder: '', strategy: 'generic' };
  throw new Error('No encontramos la letra en esa página. Copia la letra y pégala en el cuadro de texto.');
}

// [plainLyrics]: text/plain, .lrc o .txt → letra (quita marcas de tiempo LRC «[00:12.34]») | Función pura
export function plainLyrics(text: string, title = ''): ExtractedLyrics {
  const clean = tidy(text.replace(/^\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/gm, ''));
  if (!clean) throw new Error('El enlace no tiene texto que se pueda leer.');
  return { title, text: clean, holder: '', strategy: 'plain' };
}
