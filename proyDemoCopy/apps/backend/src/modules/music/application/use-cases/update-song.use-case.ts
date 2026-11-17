import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UpdateSongBody } from '../dtos/song.dto';
import { Song } from '../../domain/entities/song.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase UpdateSong · 2026-11-10]: el autor o el ADMIN edita título, artista, nivel, licencia y la glosa del título | título nuevo sin glosa → se borra la vieja (la recalcula «enriquecer»)

@Injectable()
export class UpdateSongUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
  ) {}

  async execute(actor: MusicActor, id: string, body: UpdateSongBody): Promise<Song> {
    const song = await this.access.editable(actor, id);
    const retitled = body.title !== undefined && body.title.trim() !== song.title;
    Object.assign(song, {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.artist !== undefined ? { artist: body.artist.trim() } : {}),
      ...(body.level ? { level: body.level } : {}),
      ...(body.license ? { license: body.license } : {}),
      titleIpa: body.titleIpa?.trim().replace(/^\/|\/$/g, '') ?? (retitled ? '' : song.titleIpa),
      titleTranslation: body.titleTranslation?.trim() ?? (retitled ? '' : song.titleTranslation),
    });
    return this.songs.save(song);
  }
}
