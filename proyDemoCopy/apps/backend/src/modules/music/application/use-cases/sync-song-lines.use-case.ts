import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ALIGNMENT,
  type AlignmentPort,
  type LineTiming,
} from '../../../../shared/domain/interfaces/alignment.interface';
import {
  SongLine,
  type TimingSource,
} from '../../domain/entities/song-line.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
import { StreamSongAudioUseCase } from './stream-song-audio.use-case';
// [UseCase SyncSongLines · Sprints 9.2/9.4/9.9 · RF-119]: guarda en lote las correcciones de IPA, traducción y tiempos (la corrección manual prevalece) y propone tiempos con FastAPI Alignment sin guardarlos (en canciones la música reduce la precisión) | [Patrón]: Use Case (Command) + Ports & Adapters (AlignmentPort) | [Principio]: SRP + verificación humana + Fail Fast (tiempos coherentes) | [Paradigma]: POO + async/await

export interface LinePatch {
  id: string;
  text?: string;
  ipa?: string;
  ipaUs?: string;
  translation?: string;
  startS?: number;
  endS?: number;
  reviewed?: boolean;
}

@Injectable()
export class SyncSongLinesUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
    private readonly audio: StreamSongAudioUseCase,
    @Inject(ALIGNMENT) private readonly alignment: AlignmentPort,
  ) {}

  async execute(
    actor: MusicActor,
    songId: string,
    patches: LinePatch[],
    timingSource: TimingSource = 'manual',
  ): Promise<SongLine[]> {
    await this.access.editable(actor, songId);
    const current = new Map(
      (await this.lines.findBy({ songId })).map((l) => [l.id, l]),
    );
    const changed = patches.map((p) => {
      const line = current.get(p.id);
      if (!line)
        throw new BadRequestException(
          'Una de las líneas no pertenece a la canción',
        );
      const { reviewed } = p;
      Object.assign(
        line,
        Object.fromEntries(
          Object.entries(p).filter(
            ([k, v]) => v !== undefined && k !== 'id' && k !== 'reviewed',
          ),
        ),
      );
      if (p.startS !== undefined || p.endS !== undefined)
        line.timingSource = timingSource;
      // [Corrección manual]: tocar IPA, traducción o texto marca la línea como revisada (el enriquecido automático ya no la pisa)
      if (reviewed !== undefined) line.reviewed = reviewed;
      else if (
        p.ipa !== undefined ||
        p.ipaUs !== undefined ||
        p.translation !== undefined ||
        p.text !== undefined
      )
        line.reviewed = true;
      if (line.startS !== null && line.endS !== null && line.endS < line.startS)
        throw new BadRequestException(
          `La línea ${line.position + 1} termina antes de empezar`,
        );
      return line;
    });
    await this.lines.save(changed);
    return this.lines.find({ where: { songId }, order: { position: 'ASC' } });
  }

  // [propose]: tiempos sugeridos por Alignment (no se guardan: el docente los acepta o los ajusta en el editor de sincronización)
  async propose(
    actor: MusicActor,
    songId: string,
    token: string,
  ): Promise<{ lines: (LineTiming & { id: string })[]; proposed: true }> {
    const song = await this.access.editable(actor, songId);
    const lines = await this.lines.find({
      where: { songId },
      order: { position: 'ASC' },
    });
    if (!lines.length) throw new BadRequestException('Primero carga la letra');
    const { audio, mime } = await this.audio.buffer(actor, songId);
    const res = await this.alignment.align(
      {
        audio,
        mime,
        lines: lines.map((l) => l.text),
        language: song.language,
        kind: 'song',
      },
      token,
    );
    return {
      lines: res.lines.map((t) => ({ ...t, id: lines[t.index].id })),
      proposed: true,
    };
  }
}
