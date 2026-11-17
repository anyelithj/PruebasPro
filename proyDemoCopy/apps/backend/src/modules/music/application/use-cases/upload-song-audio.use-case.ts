import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MEDIA_EXT, mediaMime } from '../../../../shared/http/audio-mime';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { Song } from '../../domain/entities/song.entity';
import { classifyMediaLink, findMediaInHtml, MEDIA_LINK_MESSAGES, toEmbedUrl } from '../../domain/media-links'; // [2026-10-24]: páginas de letras/streaming → mensaje concreto sin descargar nada
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase UploadSongAudio · Sprint 9.2 · RF-116]: sube el audio de la canción al almacén de objetos (prefijo «music») y reemplaza el anterior; si estaba publicada vuelve a revisión | [Patrón]: Use Case (Command) + Ports & Adapters (ObjectStore: disco, MinIO o R2) | [Principio]: SRP + DIP + mínimo privilegio | [Paradigma]: POO + async/await

export const MUSIC_STORE = Symbol('MUSIC_STORE');
export const MAX_SONG_AUDIO_BYTES = 100 * 1024 * 1024; // [2026-11-03]: 20 → 100 MB (un MP4 de 4 min ya pasaba de 20) · mismo límite que FastAPI Alignment y el BFF
export const SONG_AUDIO_MIME =
  /^(audio\/(mpeg|mp3|ogg|wav|x-wav|webm|mp4|x-m4a|aac|flac)|video\/(mp4|webm))(;.*)?$/; // [2026-10-20]: + vídeo MP4/WebM (se reproduce su pista de audio)
export const SONG_MEDIA_HINT = 'MP3, OGG, WAV, M4A, FLAC, MP4 o WEBM';

export interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string; // [2026-10-20]: la extensión ayuda cuando el navegador manda `application/octet-stream`
}

@Injectable()
export class UploadSongAudioUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @Inject(MUSIC_STORE) private readonly store: ObjectStore,
  ) {}

  async execute(
    actor: MusicActor,
    id: string,
    file: UploadedAudio,
  ): Promise<Song> {
    if (!file?.buffer?.length) throw new BadRequestException('Falta el audio');
    // [Bug 2026-10-20]: un MP3 válido llegaba como `application/octet-stream` → ahora decide la firma del archivo (magic bytes)
    const mime = mediaMime(file);
    if (!mime)
      throw new BadRequestException(
        `Formato de audio no admitido (${SONG_MEDIA_HINT})`,
      );
    const song = await this.access.editable(actor, id);
    const previous = song.audioKey;
    const key = `songs/${song.id}/${randomUUID()}.${MEDIA_EXT[mime]}`; // Clave nueva: la URL firmada anterior deja de servir
    await this.store.put(key, file.buffer, mime);
    Object.assign(song, {
      audioKey: key,
      audioMime: mime,
      audioSize: file.size,
      embedUrl: null, // [2026-11-04]: archivo nuevo = suena el archivo (se quita el reproductor de YouTube/Spotify)
      status: song.status === 'published' ? 'review' : song.status, // Audio nuevo = el ADMIN vuelve a revisar
    });
    const saved = await this.songs.save(song);
    if (previous) await this.store.remove(previous);
    return saved;
  }

  // [fromLink · 2026-11-04]: CUALQUIER enlace → streaming: reproductor oficial · archivo: se descarga y guarda · página web: el audio/reproductor que contiene
  async fromLink(actor: MusicActor, id: string, url: string): Promise<Song> {
    const embedded = await this.linkEmbed(actor, id, url);
    if (embedded) return embedded;
    const media = await fetchMediaUrl(url);
    if (!('pageLink' in media)) return this.execute(actor, id, media);
    const inner = await this.linkEmbed(actor, id, media.pageLink);
    if (inner) return inner;
    const file = await fetchMediaUrl(media.pageLink, MAX_SONG_AUDIO_BYTES, true);
    if ('pageLink' in file) throw new BadRequestException(MEDIA_LINK_MESSAGES.html_page);
    return this.execute(actor, id, file);
  }

  // [linkEmbed · 2026-11-03]: enlace de YouTube/Spotify… → se guarda su reproductor oficial (sin descargar el audio) | otro enlace → null (el llamador lo descarga)
  async linkEmbed(actor: MusicActor, id: string, url: string): Promise<Song | null> {
    if (classifyMediaLink(url) !== 'streaming_page') return null;
    const embed = toEmbedUrl(url);
    if (!embed) throw new BadRequestException(MEDIA_LINK_MESSAGES.streaming_page);
    const song = await this.access.editable(actor, id);
    // [2026-11-04]: el enlace de YouTube/Spotify REEMPLAZA al audio subido antes → el reproductor solo se veía sin archivo y la canción seguía sonando con el MP4 viejo
    const previous = song.audioKey;
    Object.assign(song, { embedUrl: embed, audioKey: null, audioMime: null, audioSize: null, status: song.status === 'published' ? 'review' : song.status });
    const saved = await this.songs.save(song);
    if (previous) await this.store.remove(previous);
    return saved;
  }
}


// [fetchMediaUrl · 2026-10-20]: descarga un audio/vídeo DIRECTO (enlace a .mp3/.mp4…) para «subir por URL» | [Seguridad]: solo https/http públicos,
// sin redirecciones a otra red, tope de tamaño y de tiempo (anti-SSRF básico) · páginas HTML (YouTube, Spotify) no se admiten: no son el archivo
// `followed`: true = el enlace ya salió de una página (no se sigue otra vez) | `{ pageLink }`: la página traía su audio en otro enlace → el llamador decide (descargar o insertar reproductor)
export async function fetchMediaUrl(raw: string, maxBytes = MAX_SONG_AUDIO_BYTES, followed = false): Promise<UploadedAudio | { pageLink: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Escribe un enlace válido (https://…)');
  }
  // [Fail Fast · 2026-10-24]: página de letras o de streaming conocida → 400 con QUÉ HACER, sin petición saliente | `kind` (MediaLinkKind): Specification del dominio
  const kind = classifyMediaLink(raw);
  if (kind === 'lyrics_page' || kind === 'streaming_page') throw new BadRequestException(MEDIA_LINK_MESSAGES[kind]);
  const host = url.hostname.toLowerCase();
  // `RegExp` (JS): bloquea localhost, IPs privadas y de enlace local (la API no debe pedir recursos de la red interna)
  if (!/^https?:$/.test(url.protocol) || /^(localhost|.*\.local|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd])/.test(host))
    throw new BadRequestException('Ese enlace no se puede descargar (solo direcciones públicas http/https)');
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res?.ok || !res.body) throw new BadRequestException('No se pudo descargar el enlace');
  // [2026-11-04]: página web → se busca el audio/vídeo que contiene (archivo o reproductor) y se sigue con ESE enlace (un solo salto)
  if (/text\/html/.test(res.headers.get('content-type') ?? '')) {
    const html = (await res.text()).slice(0, 2_000_000);
    const found = findMediaInHtml(html, res.url || url.href);
    if (!found || followed) throw new BadRequestException(MEDIA_LINK_MESSAGES.html_page);
    return { pageLink: found };
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += c.length;
    if (size > maxBytes) throw new BadRequestException(`El archivo supera ${Math.round(maxBytes / 1048576)} MB`);
    chunks.push(Buffer.from(c));
  }
  return {
    buffer: Buffer.concat(chunks),
    mimetype: res.headers.get('content-type') ?? '',
    size,
    originalname: url.pathname.split('/').pop() ?? '',
  };
}
