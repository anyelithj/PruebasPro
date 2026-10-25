import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from '../../domain/entities/song.entity';
import type { License } from '../../domain/value-objects/license.vo';
import type { MusicActor } from './get-song.use-case';
// [UseCase CreateSong · Sprint 9.2 · RF-116]: el docente crea la canción con idioma, nivel y declaración de licencia; nace en borrador (el audio se sube aparte y el ADMIN revisa antes de publicar) | [Patrón]: Use Case (Command) | [Principio]: SRP + verificación humana | [Paradigma]: POO

export interface SongInput {
  title: string;
  artist?: string;
  language: string;
  level: string;
  license: License;
}

@Injectable()
export class CreateSongUseCase {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
  ) {}

  execute(actor: MusicActor, input: SongInput): Promise<Song> {
    return this.songs.save(
      this.songs.create({
        ...input,
        artist: input.artist ?? '',
        status: 'draft',
        reviewNote: '',
        audioKey: null,
        audioMime: null,
        audioSize: null,
        practiceIds: {},
        createdBy: actor.id,
        withdrawnAt: null,
      }),
    );
  }
}
