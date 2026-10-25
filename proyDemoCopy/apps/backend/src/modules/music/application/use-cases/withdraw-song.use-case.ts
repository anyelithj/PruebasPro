import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { Song } from '../../domain/entities/song.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
import { MUSIC_STORE } from './upload-song-audio.use-case';
// [UseCase WithdrawSong · Sprint 9.2 · RF-128]: retira la canción (borrado lógico) y borra su audio del almacén; también atiende solicitudes de retiro por derechos de autor (ADMIN) | [Patrón]: Soft Delete | [Principio]: SRP + cumplimiento de derechos de autor (el archivo deja de existir) | [Paradigma]: POO

@Injectable()
export class WithdrawSongUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @Inject(MUSIC_STORE) private readonly store: ObjectStore,
  ) {}

  async execute(actor: MusicActor, id: string): Promise<void> {
    const song = await this.access.editable(actor, id);
    if (song.audioKey) await this.store.remove(song.audioKey);
    Object.assign(song, {
      withdrawnAt: new Date(),
      audioKey: null,
      audioSize: null,
    });
    await this.songs.save(song);
  }
}
