import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { assertUniqueTitle } from '../../../../shared/application/unique-title'; // [2026-10-28]: regla anti-duplicados compartida (DRY)
import { Song } from '../../domain/entities/song.entity';
import type { License } from '../../domain/value-objects/license.vo';
import type { MusicActor } from './get-song.use-case';
// [UseCase CreateSong · Sprint 9.2 · RF-116]: el docente crea la canción con idioma, nivel y declaración de licencia; nace en borrador (el audio se sube aparte y el ADMIN revisa antes de publicar) | [Patrón]: Use Case (Command) | [Principio]: SRP + verificación humana | [Paradigma]: POO

export interface SongInput {
  title: string;
  artist?: string;
  language: string;
  level?: string; // [2026-11-16 · RF-148]: opcional → lo estima ReplaceSongLines a partir de la letra
  license: License;
}

@Injectable()
export class CreateSongUseCase {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
  ) {}

  async execute(actor: MusicActor, input: SongInput): Promise<Song> {
    // [Fix 2026-10-28 · Sin duplicados]: misma canción (título normalizado) en el mismo idioma + nivel y no retirada → 409 | `IsNull()` (TypeORM): WHERE withdrawn_at IS NULL
    await assertUniqueTitle(
      this.songs,
      input.title,
      { language: input.language, ...(input.level ? { level: input.level } : {}), withdrawnAt: IsNull() },
      { label: 'una canción', language: input.language, level: input.level },
    );
    return this.songs.save(
      this.songs.create({
        ...input,
        level: input.level ?? null,
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
