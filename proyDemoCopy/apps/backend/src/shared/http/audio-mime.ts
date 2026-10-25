// [audioMime · 2026-10-20]: tipo real de un audio/vídeo subido — mira los «magic bytes» y la extensión, no solo el Content-Type del navegador
// [Por qué]: en Windows un .mp3 llega a veces como `application/octet-stream` (o vacío) → «Formato de audio no admitido» aunque el archivo era válido
// [Patrón]: Chain of Responsibility (firma → tipo declarado → extensión) | [Principio]: DRY (Music y Dialogues) + Fail Fast | [Paradigma]: funciones puras

// `as const` (TS): tipo → extensión con la que se guarda en el almacén
export const MEDIA_EXT = {
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'video/mp4': 'mp4', // [Vídeo]: <audio> reproduce la pista de sonido de un MP4/WebM
  'video/webm': 'webm',
} as const;
export type MediaMime = keyof typeof MEDIA_EXT;

// [Alias]: nombres que mandan navegadores y sistemas → tipo canónico
const ALIAS: Record<string, MediaMime> = {
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mpeg-3': 'audio/mpeg',
  'audio/ogg': 'audio/ogg',
  'audio/opus': 'audio/ogg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/webm': 'audio/webm',
  'audio/mp4': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/aac': 'audio/aac',
  'audio/x-aac': 'audio/aac',
  'audio/flac': 'audio/flac',
  'audio/x-flac': 'audio/flac',
  'video/mp4': 'video/mp4',
  'video/webm': 'video/webm',
};
const BY_EXT: Record<string, MediaMime> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  weba: 'audio/webm',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
};

// [sniff]: firma binaria de los primeros bytes | `Buffer.subarray` (Node) sin copiar
function sniff(b: Buffer): MediaMime | null {
  const ascii = (from: number, to: number) => b.subarray(from, to).toString('latin1');
  if (ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return 'audio/mpeg'; // ID3 o trama MPEG
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return 'audio/aac'; // ADTS
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(0, 4) === 'fLaC') return 'audio/flac';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'; // EBML (WebM/Matroska)
  if (ascii(4, 8) === 'ftyp') return /M4A |M4B /.test(ascii(8, 12)) ? 'audio/mp4' : 'video/mp4';
  return null;
}

// [mediaMime]: tipo canónico o null (no es audio/vídeo admitido)
export function mediaMime(file: { buffer: Buffer; mimetype?: string; originalname?: string }): MediaMime | null {
  const sniffed = sniff(file.buffer);
  const declared = ALIAS[(file.mimetype ?? '').split(';')[0].trim().toLowerCase()];
  const ext = BY_EXT[(file.originalname ?? '').split('.').pop()?.toLowerCase() ?? ''];
  // WebM con solo audio (grabaciones del navegador) → se respeta lo declarado
  if (sniffed === 'video/webm' && declared === 'audio/webm') return declared;
  return sniffed ?? declared ?? ext ?? null;
}
