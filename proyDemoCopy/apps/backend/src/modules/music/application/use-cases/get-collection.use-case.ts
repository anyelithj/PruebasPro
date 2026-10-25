import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SongCollection } from '../../domain/entities/song-collection.entity';
import type { MusicActor } from './get-song.use-case';
import { ListSongsUseCase } from './list-songs.use-case';
// [UseCase GetCollection · Sprint 9.2 · RF-115]: colección con sus canciones en orden (solo las que el usuario puede ver) | [Patrón]: Query | [Principio]: SRP + DRY (la visibilidad la decide ListSongs) | [Paradigma]: POO

@Injectable()
export class GetCollectionUseCase {
  constructor(
    @InjectRepository(SongCollection)
    private readonly collections: Repository<SongCollection>,
    private readonly songs: ListSongsUseCase,
  ) {}

  async load(id: string): Promise<SongCollection> {
    const c = await this.collections.findOneBy({ id, archivedAt: IsNull() });
    if (!c) throw new NotFoundException('Colección no encontrada');
    return c;
  }

  async execute(actor: MusicActor, id: string) {
    const collection = await this.load(id);
    return {
      ...collection,
      songs: await this.songs.execute(actor, { collection: id }),
    };
  }
}
