import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { Song } from '../../domain/entities/song.entity';
import { SongCollection } from '../../domain/entities/song-collection.entity';
// [UseCase ListCollections · Sprint 9.2 · RF-115]: colecciones activas por idioma y nivel con el número de canciones publicadas | [Patrón]: Query + Soft Delete | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class ListCollectionsUseCase {
  constructor(
    @InjectRepository(SongCollection)
    private readonly collections: Repository<SongCollection>,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
  ) {}

  async execute(f: { language?: string; level?: string }) {
    const where: FindOptionsWhere<SongCollection> = {
      archivedAt: IsNull(),
      ...(f.language ? { language: f.language } : {}),
      ...(f.level ? { level: f.level } : {}),
    };
    const list = await this.collections.find({
      where,
      order: { title: 'ASC' },
    });
    const ids = [...new Set(list.flatMap((c) => c.songIds))];
    // Una sola consulta para contar las publicadas de todas las colecciones (sin N+1)
    const published = new Set(
      ids.length
        ? (
            await this.songs.find({
              where: {
                id: In(ids),
                status: 'published',
                withdrawnAt: IsNull(),
              },
              select: { id: true },
            })
          ).map((s) => s.id)
        : [],
    );
    return list.map((c) => ({
      ...c,
      songCount: c.songIds.filter((id) => published.has(id)).length,
    }));
  }
}
