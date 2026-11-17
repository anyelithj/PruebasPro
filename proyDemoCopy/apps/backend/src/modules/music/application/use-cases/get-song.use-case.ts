import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Song } from '../../domain/entities/song.entity';
import { SongLine } from '../../domain/entities/song-line.entity';
import { songBlockers } from '../../domain/song-readiness';
import { CaptionTimings } from './caption-timings.service';
// [UseCases SongAccess + GetSong · Sprint 9.2 · RF-117/RF-119]: carga una canción según el rol (borradores solo para su autor o ADMIN) y la devuelve con sus líneas, IPA, traducción y tiempos | [Patrón]: Query + Guard reutilizable | [Principio]: SRP + mínimo privilegio + DRY | [Paradigma]: POO

export interface MusicActor {
  id: string;
  role: string; // USER | TEACHER | ADMIN (del JWT)
}
export const isStaff = (a: MusicActor): boolean =>
  a.role === 'TEACHER' || a.role === 'ADMIN';

@Injectable()
export class SongAccess {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
  ) {}

  // [readable]: publicada para todos; borrador, en revisión o rechazada solo para su autor y el ADMIN («no existe» para el resto)
  async readable(actor: MusicActor, id: string): Promise<Song> {
    const s = await this.songs.findOneBy({ id, withdrawnAt: IsNull() });
    if (!s || (s.status !== 'published' && !this.canEdit(actor, s)))
      throw new NotFoundException('Canción no encontrada');
    return s;
  }

  async editable(actor: MusicActor, id: string): Promise<Song> {
    const s = await this.songs.findOneBy({ id, withdrawnAt: IsNull() });
    if (!s) throw new NotFoundException('Canción no encontrada');
    if (!this.canEdit(actor, s))
      throw new ForbiddenException('Solo el autor o un ADMIN puede editarla');
    return s;
  }

  canEdit(actor: MusicActor, s: Song): boolean {
    return (
      actor.role === 'ADMIN' || (isStaff(actor) && s.createdBy === actor.id)
    );
  }
}

@Injectable()
export class GetSongUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
    private readonly captions: CaptionTimings, // [2026-11-06]: tiempos reales desde los subtítulos de YouTube
  ) {}

  async execute(actor: MusicActor, id: string) {
    const song = await this.access.readable(actor, id);
    const lines = await this.captions.fill(
      song,
      await this.lines.find({ where: { songId: id }, order: { position: 'ASC' } }),
    );
    const editable = this.access.canEdit(actor, song);
    // [2026-11-10]: canciones antiguas sin glosa guardada → si el título es un verso, su IPA y traducción (gratis, sin IA)
    if (!song.titleIpa) {
      const key = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const same = lines.find((l) => key(l.text) === key(song.title) && l.ipa);
      if (same) Object.assign(song, { titleIpa: same.ipa, titleTranslation: song.titleTranslation || (same.translation ?? '') });
    }
    // [2026-10-24 · blockers]: solo quien edita ve qué falta para publicar (checklist del asistente)
    return { ...song, lines, editable, ...(editable ? { blockers: songBlockers(song, lines.length) } : {}) };
  }
}
