import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { Song, type SongStatus } from '../../domain/entities/song.entity';
import { SongCollection } from '../../domain/entities/song-collection.entity';
import type { MusicActor } from './get-song.use-case';
// [UseCase ListSongs · Sprint 9.2 · RF-115]: canciones por idioma, nivel y colección — publicadas para todos; «mías» (cualquier estado) para el docente; cola de revisión para el ADMIN | [Patrón]: Query + Soft Delete | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

export interface SongFilter {
  language?: string;
  level?: string;
  collection?: string;
  status?: SongStatus;
  mine?: boolean;
}

@Injectable()
export class ListSongsUseCase {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(SongCollection)
    private readonly collections: Repository<SongCollection>,
  ) {}

  async execute(actor: MusicActor, f: SongFilter): Promise<Song[]> {
    const where: FindOptionsWhere<Song> = {
      withdrawnAt: IsNull(),
      ...(f.language ? { language: f.language } : {}),
      ...(f.level ? { level: f.level } : {}),
    };
    if (f.mine) where.createdBy = actor.id;
    // [Visibilidad]: el ADMIN filtra por cualquier estado (cola «review»); los demás ven publicadas salvo en «mías»
    if (actor.role === 'ADMIN' && f.status) where.status = f.status;
    else if (!f.mine) where.status = 'published';
    if (f.collection) {
      const c = await this.collections.findOneBy({
        id: f.collection,
        archivedAt: IsNull(),
      });
      if (!c?.songIds.length) return [];
      const found = await this.songs.find({
        where: { ...where, id: In(c.songIds) },
      });
      return c.songIds
        .map((id) => found.find((s) => s.id === id))
        .filter((s): s is Song => !!s); // Orden de la colección
    }
    return this.songs.find({ where, order: { level: 'ASC', title: 'ASC' } });
  }
}
