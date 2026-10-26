import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SongLine } from '../../domain/entities/song-line.entity';
import { EnrichSongLinesUseCase } from './enrich-song-lines.use-case';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase ReplaceSongLines · Sprint 9.2 · RF-117]: divide la letra en líneas, las guarda (reemplazando las anteriores) y pide su traducción e IPA; si FastAPI no responde las líneas quedan guardadas sin IPA y se pueden enriquecer después | [Patrón]: Use Case (Command) + Unit of Work (borrar e insertar juntos) | [Principio]: SRP + DRY (EnrichSongLines) + degradación elegante | [Paradigma]: POO + funcional (splitLyrics pura)

const MAX_LINES = 400;

// [splitLyrics]: un verso por línea; se quitan espacios y líneas vacías (separadores de estrofa) | Función pura
export const splitLyrics = (lyrics: string): string[] =>
  lyrics
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

@Injectable()
export class ReplaceSongLinesUseCase {
  private readonly logger = new Logger(ReplaceSongLinesUseCase.name);

  constructor(
    private readonly access: SongAccess,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
    private readonly enrich: EnrichSongLinesUseCase,
  ) {}

  async execute(
    actor: MusicActor,
    songId: string,
    lyrics: string,
    token: string,
    auto = true, // [Modo manual]: false → se guardan las líneas sin pedir IPA ni traducción
  ) {
    const texts = splitLyrics(lyrics);
    if (!texts.length) throw new BadRequestException('La letra está vacía');
    if (texts.length > MAX_LINES)
      throw new BadRequestException(`Máximo ${MAX_LINES} líneas`);
    await this.access.editable(actor, songId);
    // `transaction` (TypeORM): nunca queda una letra a medias
    await this.lines.manager.transaction(async (tx) => {
      await tx.delete(SongLine, { songId });
      await tx.save(
        texts.map((text, position) =>
          tx.create(SongLine, {
            songId,
            position,
            text,
            ipa: '',
            ipaUs: null,
            translation: null,
          }),
        ),
      );
    });
    if (!auto)
      return {
        lines: await this.lines.find({ where: { songId }, order: { position: 'ASC' } }),
        enriched: false,
        missing: 0, // Modo manual: no se pidió nada automático
      };
    try {
      // [2026-10-24]: enriquecimiento por trozos con reintento y respaldo de IPA → `missing` dice cuántas líneas quedan por completar
      const { lines, missing } = await this.enrich.run(actor, songId, token);
      return { lines, enriched: missing === 0, missing };
    } catch (err) {
      this.logger.warn(
        `Letra ${songId} guardada sin IPA: ${err instanceof Error ? err.message : String(err)}`,
      );
      const lines = await this.lines.find({
        where: { songId },
        order: { position: 'ASC' },
      });
      return { lines, enriched: false, missing: lines.length };
    }
  }

  // [clear]: borra la letra para volver a cargarla (DELETE /music/songs/:id/lines)
  async clear(actor: MusicActor, songId: string): Promise<void> {
    await this.access.editable(actor, songId);
    await this.lines.delete({ songId });
  }
}
