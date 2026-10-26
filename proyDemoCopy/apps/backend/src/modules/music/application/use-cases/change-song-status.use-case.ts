import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song, type SongStatus } from '../../domain/entities/song.entity';
import { SongLine } from '../../domain/entities/song-line.entity';
import { blockersMessage, songBlockers } from '../../domain/song-readiness';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase ChangeSongStatus · Sprint 9.2 · RF-116/RF-128]: el docente envía a revisión (o la retira de ella); el ADMIN publica o rechaza con motivo; solo se publica con licencia declarada, audio y letra | [Patrón]: State Machine (transiciones permitidas por rol) + Specification (songBlockers) | [Principio]: mínimo privilegio + verificación humana + Fail Fast | [Paradigma]: POO + funcional
// [2026-10-24]: los requisitos viven en domain/song-readiness (SSOT) → el 400 enumera TODO lo que falta y la UI muestra la misma lista antes de llamar

// [Transiciones]: estado actual → estados a los que puede pasar (y quién)
const AUTHOR: Partial<Record<SongStatus, SongStatus[]>> = {
  draft: ['review'],
  rejected: ['review'],
  review: ['draft'],
};
const ADMIN: Partial<Record<SongStatus, SongStatus[]>> = {
  ...AUTHOR,
  review: ['draft', 'published', 'rejected'],
  published: ['draft'],
};

@Injectable()
export class ChangeSongStatusUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
  ) {}

  async execute(
    actor: MusicActor,
    id: string,
    to: SongStatus,
    note = '',
  ): Promise<Song> {
    const song = await this.access.editable(actor, id);
    const allowed =
      (actor.role === 'ADMIN' ? ADMIN : AUTHOR)[song.status] ?? [];
    if (!allowed.includes(to))
      throw new ForbiddenException(
        `No se puede pasar de «${song.status}» a «${to}»`,
      );
    if (to === 'review' || to === 'published') {
      // [Specification]: licencia, audio y letra — mismo cálculo que ve la UI en `blockers`
      const problem = blockersMessage(
        song,
        songBlockers(song, await this.lines.countBy({ songId: id })),
      );
      if (problem) throw new BadRequestException(problem);
    }
    if (to === 'rejected' && !note.trim())
      throw new BadRequestException('Explica al docente por qué se rechaza');
    song.status = to;
    song.reviewNote = to === 'rejected' ? note.trim() : '';
    return this.songs.save(song);
  }
}
