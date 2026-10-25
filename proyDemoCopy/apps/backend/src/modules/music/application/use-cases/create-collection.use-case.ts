import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SongCollection } from '../../domain/entities/song-collection.entity';
import type { MusicActor } from './get-song.use-case';
// [UseCase CreateCollection · Sprint 9.2 · RF-115]: el docente o ADMIN crea una colección de canciones por idioma, nivel o tema | [Patrón]: Use Case (Command) | [Principio]: SRP | [Paradigma]: POO

export interface CollectionInput {
  title: string;
  description?: string;
  language: string;
  level?: string;
  theme?: string;
  emoji?: string;
  songIds?: string[];
}

@Injectable()
export class CreateCollectionUseCase {
  constructor(
    @InjectRepository(SongCollection)
    private readonly collections: Repository<SongCollection>,
  ) {}

  execute(actor: MusicActor, input: CollectionInput): Promise<SongCollection> {
    return this.collections.save(
      this.collections.create({
        title: input.title,
        description: input.description ?? '',
        language: input.language,
        level: input.level ?? null,
        theme: input.theme ?? null,
        emoji: input.emoji ?? '🎵',
        songIds: [...new Set(input.songIds ?? [])], // `Set`: sin canciones repetidas
        createdBy: actor.id,
        archivedAt: null,
      }),
    );
  }
}
