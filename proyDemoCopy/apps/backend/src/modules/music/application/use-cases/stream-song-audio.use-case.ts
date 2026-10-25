import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RangedSource } from '../../../../shared/http/ranged-response';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { type MusicActor, SongAccess } from './get-song.use-case';
import { MUSIC_STORE } from './upload-song-audio.use-case';
// [UseCase StreamSongAudio · Sprint 9.2 · RF-119]: fuente por rangos del audio (Range 206 para adelantar y repetir líneas; URL firmada si el almacén es S3/R2) | [Patrón]: Query + Ports & Adapters (ObjectStore) | [Principio]: SRP + DRY (sendRanged compartido con Audio, Courses y Reports) | [Paradigma]: POO

@Injectable()
export class StreamSongAudioUseCase {
  constructor(
    private readonly access: SongAccess,
    @Inject(MUSIC_STORE) private readonly store: ObjectStore,
  ) {}

  async execute(actor: MusicActor, id: string): Promise<RangedSource> {
    const song = await this.access.readable(actor, id);
    const key = song.audioKey;
    const size = key ? await this.store.size(key) : null;
    if (!key || size === null)
      throw new NotFoundException('La canción aún no tiene audio');
    const contentType = song.audioMime ?? 'audio/mpeg';
    return {
      size,
      contentType,
      open: (range) => this.store.open(key, range),
      signedUrl: await this.store.signedUrl(key, {
        filename: `${song.title}.${key.split('.').pop()}`,
        contentType,
        disposition: 'inline',
      }),
    };
  }

  // [buffer]: audio completo en memoria para enviarlo a FastAPI Alignment (≤ 20 MB) | `for await` (Node streams)
  async buffer(
    actor: MusicActor,
    id: string,
  ): Promise<{ audio: Buffer; mime: string }> {
    const src = await this.execute(actor, id);
    const chunks: Buffer[] = [];
    for await (const c of await src.open())
      chunks.push(Buffer.from(c as Uint8Array));
    return { audio: Buffer.concat(chunks), mime: src.contentType };
  }
}
