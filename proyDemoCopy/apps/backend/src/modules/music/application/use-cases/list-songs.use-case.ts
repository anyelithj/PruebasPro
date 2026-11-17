import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { Song, type SongStatus } from '../../domain/entities/song.entity';
import { SongCollection } from '../../domain/entities/song-collection.entity';
import { SongLine } from '../../domain/entities/song-line.entity';
import { type SongBlocker, songBlockers } from '../../domain/song-readiness';
import { isStaff, type MusicActor } from './get-song.use-case';
// [UseCase ListSongs · Sprint 9.2 · RF-115]: canciones por idioma, nivel y colección — publicadas para todos; «mías» (cualquier estado) para el docente; cola de revisión para el ADMIN | [Patrón]: Query + Soft Delete | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

export interface SongFilter {
  language?: string;
  level?: string;
  collection?: string;
  status?: SongStatus;
  mine?: boolean;
}

// [SongView · 2026-10-24]: canción + lo que le falta para publicarse (solo en vistas de gestión: «mías» y ADMIN) | `&` (TS): tipo intersección
export type SongView = Song & { blockers?: SongBlocker[] };

@Injectable()
export class ListSongsUseCase {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(SongCollection)
    private readonly collections: Repository<SongCollection>,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
  ) {}

  async execute(actor: MusicActor, f: SongFilter): Promise<SongView[]> {
    const found = await this.find(actor, f);
    // [Gestión]: el autor (mine) y el ADMIN reciben `blockers` → Gestión · Actividades deshabilita «Publicar» y dice qué falta
    return (f.mine && isStaff(actor)) || actor.role === 'ADMIN' ? this.withBlockers(found) : found;
  }

  // [withBlockers]: UNA consulta agrupada con el número de líneas por canción (sin N+1) | `GROUP BY` (SQL) vía QueryBuilder de TypeORM
  private async withBlockers(songs: Song[]): Promise<SongView[]> {
    if (!songs.length) return [];
    const rows = await this.lines
      .createQueryBuilder('l')
      .select('l.song_id', 'songId')
      .addSelect('COUNT(*)', 'n')
      .where('l.song_id IN (:...ids)', { ids: songs.map((s) => s.id) })
      .groupBy('l.song_id')
      .getRawMany<{ songId: string; n: string }>();
    const counts = new Map(rows.map((r) => [r.songId, Number(r.n)])); // `Map` (ES2015): búsqueda O(1) por id
    return songs.map((s) => ({ ...s, blockers: songBlockers(s, counts.get(s.id) ?? 0) }));
  }

  private async find(actor: MusicActor, f: SongFilter): Promise<Song[]> {
    const where: FindOptionsWhere<Song> = {
      withdrawnAt: IsNull(),
      ...(f.language ? { language: f.language } : {}),
      ...(f.level ? { level: f.level } : {}),
    };
    // [2026-10-28 · Causa raíz «Gestión → Música vacía»]: `mine` filtraba SIEMPRE por `createdBy = actor.id` → el ADMIN solo veía las canciones que él mismo subió
    // (las de los docentes —incluida la cola «En revisión» que solo él puede publicar— nunca aparecían en Gestión · Actividades) | mismo criterio que Reading: el ADMIN gestiona todas
    const manage = f.mine && isStaff(actor); // `&&` (JS): «mías» solo tiene sentido para quien crea (TEACHER/ADMIN); un estudiante sigue viendo solo publicadas
    if (manage && actor.role !== 'ADMIN') where.createdBy = actor.id;
    // [Visibilidad]: el ADMIN filtra por cualquier estado (cola «review»); en gestión se ven todos los estados (borradores incluidos); el resto, solo publicadas
    if (actor.role === 'ADMIN' && f.status) where.status = f.status;
    else if (!manage) where.status = 'published';
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
    // [Orden]: en gestión, lo último editado primero (el borrador recién subido aparece arriba); en el catálogo, por nivel y título
    return this.songs.find({
      where,
      order: manage ? { updatedAt: 'DESC' } : { level: 'ASC', title: 'ASC' },
    });
  }
}
