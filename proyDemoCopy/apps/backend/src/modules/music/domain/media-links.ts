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
    'Los enlaces de YouTube, Spotify y otras plataformas de streaming no se pueden importar: sube el archivo de audio del que tengas derechos o pega un enlace directo a un .mp3/.mp4.',
  html_page:
    'El enlace es una página web, no un archivo de audio o vídeo (usa el enlace directo al .mp3/.mp4)',
} as const;
