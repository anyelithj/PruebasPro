import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { SongLine } from '../../domain/entities/song-line.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase EnrichSongLines · Sprints 9.1/9.2 · RF-117]: pide a FastAPI la traducción al español y el IPA de cada línea aún no revisada (la corrección manual del docente prevalece) | [Patrón]: Use Case (Command) + Ports & Adapters (LanguageToolsPort, el mismo cliente de Vocabulary) | [Principio]: DIP + DRY + verificación humana | [Paradigma]: POO + async/await

@Injectable()
export class EnrichSongLinesUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  async execute(
    actor: MusicActor,
    songId: string,
    token: string,
  ): Promise<SongLine[]> {
    const song = await this.access.editable(actor, songId);
    const pending = await this.lines.find({
      where: { songId, reviewed: false },
      order: { position: 'ASC' },
    });
    if (pending.length) {
      const res = await this.tools.lines(
        pending.map((l) => l.text),
        song.language,
        token,
      );
      pending.forEach((l, i) => {
        const e = res.lines[i];
        Object.assign(l, {
          ipa: e.ipa,
          ipaUs: e.ipa_us,
          translation: e.translation,
          needsNativeReview: res.needs_native_review,
        });
      });
      await this.lines.save(pending);
    }
    return this.lines.find({ where: { songId }, order: { position: 'ASC' } });
  }
}
