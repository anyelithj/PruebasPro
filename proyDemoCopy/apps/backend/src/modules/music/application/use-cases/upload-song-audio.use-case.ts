import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MEDIA_EXT, mediaMime } from '../../../../shared/http/audio-mime';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { Song } from '../../domain/entities/song.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase UploadSongAudio · Sprint 9.2 · RF-116]: sube el audio de la canción al almacén de objetos (prefijo «music») y reemplaza el anterior; si estaba publicada vuelve a revisión | [Patrón]: Use Case (Command) + Ports & Adapters (ObjectStore: disco, MinIO o R2) | [Principio]: SRP + DIP + mínimo privilegio | [Paradigma]: POO + async/await

export const MUSIC_STORE = Symbol('MUSIC_STORE');
export const MAX_SONG_AUDIO_BYTES = 20 * 1024 * 1024; // ≈ 4–5 min en MP3 de 320 kbps (mismo límite que FastAPI Alignment)
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
      status: song.status === 'published' ? 'review' : song.status, // Audio nuevo = el ADMIN vuelve a revisar
    });
    const saved = await this.songs.save(song);
    if (previous) await this.store.remove(previous);
    return saved;
  }
}


// [fetchMediaUrl · 2026-10-20]: descarga un audio/vídeo DIRECTO (enlace a .mp3/.mp4…) para «subir por URL» | [Seguridad]: solo https/http públicos,
// sin redirecciones a otra red, tope de tamaño y de tiempo (anti-SSRF básico) · páginas HTML (YouTube, Spotify) no se admiten: no son el archivo
export async function fetchMediaUrl(raw: string, maxBytes = MAX_SONG_AUDIO_BYTES): Promise<UploadedAudio> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Escribe un enlace válido (https://…)');
  }
  const host = url.hostname.toLowerCase();
  // `RegExp` (JS): bloquea localhost, IPs privadas y de enlace local (la API no debe pedir recursos de la red interna)
  if (!/^https?:$/.test(url.protocol) || /^(localhost|.*\.local|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd])/.test(host))
    throw new BadRequestException('Ese enlace no se puede descargar (solo direcciones públicas http/https)');
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res?.ok || !res.body) throw new BadRequestException('No se pudo descargar el enlace');
  if (/text\/html/.test(res.headers.get('content-type') ?? ''))
    throw new BadRequestException('El enlace es una página web, no un archivo de audio o vídeo (usa el enlace directo al .mp3/.mp4)');
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
