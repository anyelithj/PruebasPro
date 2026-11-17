// [MediaLinks · Dominio · 2026-10-24]: ¿qué es este enlace? — archivo de audio/vídeo directo, página de LETRAS o página de STREAMING (YouTube, Spotify…) | [Patrón]: Specification (reglas de dominio puras) + SSOT | [Principio]: Fail Fast (se decide ANTES de descargar) + DRY (la misma lista la usa «subir audio por URL» y la expone GET /music/link-rules al asistente de Angular) | [Paradigma]: Funcional (sin E/S → testeable)
// [Por qué]: un docente pegó https://www.letras.com/… en «enlace directo del audio» → 400 genérico tras descargar la página; ahora se reconoce el sitio y se ofrece «Importar la letra desde este enlace»

// [LYRICS_SITE_HOSTS]: sitios de letras que el importador de letras (lyrics-text.ts · SITE_CONTAINERS / AZLyrics) sabe leer + equivalentes habituales | `as const` (TS): tupla de literales inmutable
export const LYRICS_SITE_HOSTS = [
  'genius.com',
  'letras.com',
  'letras.mus.br',
  'azlyrics.com',
  'lyrics.com',
  'songtexte.com',
  'musixmatch.com',
  'lyricstranslate.com',
  'paroles.net',
  'paroles-musique.com',
  'testitradotti.it',
  'lyrics.az',
  'songlyrics.com',
  'metrolyrics.com',
] as const;

// [STREAMING_HOSTS]: páginas de reproducción — el servidor NO extrae su audio (sin yt-dlp: términos de uso y derechos de autor) → se explica qué hacer
export const STREAMING_HOSTS = [
  'youtube.com',
  'youtu.be',
  'music.youtube.com',
  'spotify.com',
  'soundcloud.com',
  'music.apple.com',
  'deezer.com',
  'tidal.com',
  'vimeo.com',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
] as const;

// [MediaLinkKind]: clasificación de un enlace | unión de literales (TS) → `switch` exhaustivo en quien la consuma
export type MediaLinkKind = 'invalid' | 'lyrics_page' | 'streaming_page' | 'direct';

// [MediaLinkRules]: contrato de GET /music/link-rules (espejo en Angular: features/music/domain/models/music.ts)
export interface MediaLinkRules {
  lyricsHosts: readonly string[];
  streamingHosts: readonly string[];
}

export const MEDIA_LINK_RULES: MediaLinkRules = { lyricsHosts: LYRICS_SITE_HOSTS, streamingHosts: STREAMING_HOSTS };

// [matchesHost]: dominio exacto o subdominio (www., m., es.…) — `endsWith('.' + h)` evita falsos positivos tipo «notgenius.com»
const matchesHost = (host: string, list: readonly string[]): boolean =>
  list.some((h) => host === h || host.endsWith(`.${h}`));

// [classifyMediaLink]: texto pegado → tipo de enlace | `URL` (WHATWG): normaliza mayúsculas del host y valida el esquema
export function classifyMediaLink(raw: string, rules: MediaLinkRules = MEDIA_LINK_RULES): MediaLinkKind {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return 'invalid';
  }
  if (!/^https?:$/.test(url.protocol)) return 'invalid';
  const host = url.hostname.toLowerCase();
  if (matchesHost(host, rules.lyricsHosts)) return 'lyrics_page';
  if (matchesHost(host, rules.streamingHosts)) return 'streaming_page';
  return 'direct';
}

// [MEDIA_LINK_MESSAGES]: textos accionables para el 400 de «subir audio por URL» (el asistente de Angular los evita validando antes)
export const MEDIA_LINK_MESSAGES = {
  lyrics_page:
    'Ese enlace es una página de letras, no un audio. Usa «Importar la letra desde un enlace» en el paso Letra, y sube aquí el archivo de audio (.mp3/.mp4).',
  streaming_page:
    'Ese enlace de streaming no tiene un reproductor que se pueda insertar (admitidos: YouTube, Spotify, SoundCloud, Vimeo, Deezer y Apple Music). Sube el archivo de audio o pega un enlace directo a un .mp3/.mp4.',
  html_page:
    'En esa página no se encontró ningún audio, vídeo ni reproductor (YouTube, Spotify…). Pega el enlace directo al .mp3/.mp4 o sube el archivo.',
} as const;

// [toEmbedUrl · 2026-11-03]: enlace de streaming → reproductor OFICIAL embebido (iframe del propio servicio) | el audio nunca se descarga ni se copia:
// lo reproduce YouTube/Spotify… con sus condiciones de uso (Spotify: 30 s de muestra sin sesión) | null = servicio sin reproductor embebible conocido | Función pura
export function toEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const path = url.pathname;
  const id = (re: RegExp) => path.match(re)?.[1];
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v') ?? id(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === 'youtu.be') return id(/^\/([\w-]{6,})/) ? `https://www.youtube-nocookie.com/embed/${id(/^\/([\w-]{6,})/)}` : null;
  if (host === 'open.spotify.com') {
    const m = path.match(/^\/(?:intl-[\w-]+\/)?(track|album|playlist|episode)\/(\w+)/);
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  }
  if (host === 'soundcloud.com') return path.length > 1 ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${path}`)}` : null;
  if (host === 'vimeo.com') return id(/^\/(\d+)/) ? `https://player.vimeo.com/video/${id(/^\/(\d+)/)}` : null;
  if (host === 'deezer.com') {
    const m = path.match(/\/(track|album|playlist)\/(\d+)/);
    return m ? `https://widget.deezer.com/widget/auto/${m[1]}/${m[2]}` : null;
  }
  if (host === 'music.apple.com') return `https://embed.music.apple.com${path}${url.search}`;
  return null;
}

// [EMBED_HOSTS]: orígenes que el reproductor puede cargar en <iframe> (CSP frame-src y validación en el cliente) | SSOT
export const EMBED_HOSTS = ['https://www.youtube-nocookie.com', 'https://open.spotify.com', 'https://w.soundcloud.com', 'https://player.vimeo.com', 'https://widget.deezer.com', 'https://embed.music.apple.com'] as const;

// [findMediaInHtml · 2026-11-04]: página web cualquiera (blog, web del artista, radio…) → el audio/vídeo que contiene, para que la canción suene
// Orden: archivo directo (og:audio/og:video, <audio>/<video>/<source>, enlace a .mp3/.mp4…) y, si no hay, reproductor de streaming insertado (<iframe> de YouTube, Spotify…)
// Devuelve un enlace ABSOLUTO (archivo → se descarga · página de streaming → se guarda su reproductor oficial) o null | [Paradigma]: Funcional (pura, sin E/S)
// ponytail: regex sobre el HTML (sin parser DOM) → basta para atributos src/href/content; si una web arma el reproductor con JS, no se ve
const MEDIA_FILE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|mp4|m4v|webm)(?:[?#].*)?$/i;
export function findMediaInHtml(html: string, base: string): string | null {
  const abs = (u: string): string | null => {
    try {
      const url = new URL(u.replace(/&amp;/g, '&').trim(), base);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };
  const attrs = (re: RegExp) => [...html.matchAll(re)].map((m) => abs(m[1]!)).filter((u): u is string => !!u);
  const meta = attrs(/<meta[^>]+(?:property|name)=["'](?:og:audio(?::(?:secure_)?url)?|og:video(?::(?:secure_)?url)?|twitter:player:stream)["'][^>]*content=["']([^"']+)["']/gi)
    .concat(attrs(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:audio|og:video|twitter:player:stream)/gi));
  const tags = attrs(/<(?:audio|video|source)\b[^>]*\bsrc=["']([^"']+)["']/gi);
  const links = attrs(/<a\b[^>]*\bhref=["']([^"']+)["']/gi);
  const file = [...meta, ...tags, ...links].find((u) => MEDIA_FILE.test(new URL(u).pathname) && classifyMediaLink(u) === 'direct');
  if (file) return file;
  // Reproductor insertado → enlace normal de la página de streaming (toEmbedUrl lo vuelve a convertir en el reproductor oficial)
  for (const u of [...attrs(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi), ...meta, ...links]) {
    const url = new URL(u);
    const yt = /(?:^|\.)youtube(?:-nocookie)?\.com$/i.test(url.hostname) && url.pathname.match(/^\/embed\/([\w-]{6,})/);
    if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;
    const page = url.hostname === 'open.spotify.com' ? `https://open.spotify.com${url.pathname.replace(/^\/embed/, '')}` : u;
    if (classifyMediaLink(page) === 'streaming_page' && toEmbedUrl(page)) return page;
  }
  return null;
}
