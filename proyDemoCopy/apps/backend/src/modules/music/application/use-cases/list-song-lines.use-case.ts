import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SongLine } from '../../domain/entities/song-line.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCases ListSongLines + GetSongLine · Sprint 9.2 · RF-117/RF-119]: líneas con texto original, IPA, traducción y tiempos — con la misma visibilidad que su canción | [Patrón]: Query | [Principio]: SRP + DRY (SongAccess) | [Paradigma]: POO

@Injectable()
export class ListSongLinesUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
  ) {}

  async execute(actor: MusicActor, songId: string): Promise<SongLine[]> {
    await this.access.readable(actor, songId);
    return this.lines.find({ where: { songId }, order: { position: 'ASC' } });
  }
}

@Injectable()
export class GetSongLineUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
  ) {}

  async execute(actor: MusicActor, id: string): Promise<SongLine> {
    const line = await this.lines.findOneBy({ id });
    if (!line) throw new NotFoundException('Línea no encontrada');
    await this.access.readable(actor, line.songId); // Línea de una canción no visible = «no existe»
    return line;
  }
}
