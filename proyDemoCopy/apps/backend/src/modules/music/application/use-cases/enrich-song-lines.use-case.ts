import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { SongLine } from '../../domain/entities/song-line.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase EnrichSongLines · Sprints 9.1/9.2 · RF-117]: pide a FastAPI la traducción al español y el IPA de cada línea aún no revisada (la corrección manual del docente prevalece) | [Patrón]: Use Case (Command) + Ports & Adapters (LanguageToolsPort, el mismo cliente de Vocabulary) | [Principio]: DIP + DRY + verificación humana | [Paradigma]: POO + async/await
// [2026-10-24 · Bug «el servicio de IPA y traducción no respondió»]: antes UNA petición de hasta 80 líneas → FastAPI traducía verso a verso con el LLM en CPU, superaba los 90 s del cliente y se perdía todo (también el IPA, que es inmediato)
// Ahora: trozos de CHUNK líneas · un reintento por trozo · si el trozo sigue fallando, IPA solo (fonetizador determinista, sin LLM) · cada trozo se guarda al llegar (progreso parcial) | [Patrón]: Chunking + Retry + Fallback + Partial Success

export const ENRICH_CHUNK = 20; // Líneas por petición (FastAPI traduce cada trozo en una sola llamada al LLM)
const RETRIES = 1; // Reintentos por trozo (Ollama puede estar cargando el modelo la primera vez)
const IPA_PARALLEL = 4; // Peticiones de IPA simultáneas en el respaldo (espeak-ng es rápido; no saturar FastAPI)

// [EnrichOutcome]: líneas + cuántas siguen sin IPA o sin traducción (la UI ofrece reintentar en vez de un error genérico)
export interface EnrichOutcome {
  lines: SongLine[];
  missing: number; // 0 = todo enriquecido
}

// [lacks]: ¿a la línea le falta algo automático? (español no se traduce) | Función pura
export const lacks = (l: SongLine, language: string): boolean =>
  !l.reviewed && (!l.ipa || (language !== 'es' && !l.translation));

// [chunk]: [a,b,c,d,e] → [[a,b],[c,d],[e]] | Función pura genérica (`<T>`)
export const chunk = <T>(xs: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / size) }, (_, i) =>
    xs.slice(i * size, i * size + size),
  );

@Injectable()
export class EnrichSongLinesUseCase {
  private readonly logger = new Logger(EnrichSongLinesUseCase.name);

  constructor(
    private readonly access: SongAccess,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [execute]: contrato previo (POST /lines/enrich devolvía las líneas) → delega en `run`
  async execute(
    actor: MusicActor,
    songId: string,
    token: string,
  ): Promise<SongLine[]> {
    return (await this.run(actor, songId, token)).lines;
  }

  // [run]: enriquece SOLO lo que falta (líneas sin IPA o sin traducción y no revisadas) → reintentar es barato e idempotente
  async run(
    actor: MusicActor,
    songId: string,
    token: string,
  ): Promise<EnrichOutcome> {
    const song = await this.access.editable(actor, songId);
    const pending = (
      await this.lines.find({
        where: { songId, reviewed: false },
        order: { position: 'ASC' },
      })
    ).filter((l) => lacks(l, song.language));
    // `for...of` (ES2015) en secuencia: un trozo a la vez → el LLM local no recibe peticiones en paralelo
    for (const part of chunk(pending, ENRICH_CHUNK)) {
      if (!(await this.enrichChunk(part, song.language, token)))
        await this.ipaOnly(part, song.language, token);
      await this.lines.save(part); // Progreso parcial: lo ya enriquecido no se pierde si un trozo posterior falla
    }
    const all = await this.lines.find({
      where: { songId },
      order: { position: 'ASC' },
    });
    return { lines: all, missing: all.filter((l) => lacks(l, song.language)).length };
  }

  // [enrichChunk]: traducción + IPA con reintento; true si FastAPI respondió | [Patrón]: Retry
  private async enrichChunk(
    part: SongLine[],
    language: string,
    token: string,
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await this.tools.lines(
          part.map((l) => l.text),
          language,
          token,
        );
        part.forEach((l, i) => {
          const e = res.lines[i];
          if (!e) return; // Respuesta más corta de lo esperado → la línea queda pendiente
          // `||` / `??`: nunca se pisa un valor bueno con uno vacío (p. ej. IPA que ya existía y el motor falló ahora)
          Object.assign(l, {
            ipa: e.ipa || l.ipa,
            ipaUs: e.ipa_us ?? l.ipaUs,
            translation: e.translation ?? l.translation,
            needsNativeReview: res.needs_native_review,
          });
        });
        return true;
      } catch (err) {
        this.logger.warn(
          `LanguageTools /lines falló (intento ${attempt + 1}/${RETRIES + 1}, ${part.length} líneas): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return false;
  }

  // [ipaOnly]: respaldo determinista (espeak-ng vía /ipa, sin LLM) para que al menos el IPA quede listo | [Patrón]: Fallback + Bulkhead (IPA_PARALLEL)
  private async ipaOnly(
    part: SongLine[],
    language: string,
    token: string,
  ): Promise<void> {
    for (const group of chunk(part.filter((l) => !l.ipa), IPA_PARALLEL)) {
      // `Promise.allSettled` (ES2020): un fallo no cancela el resto del grupo
      const res = await Promise.allSettled(
        group.map((l) => this.tools.ipa(l.text, language, token)),
      );
      res.forEach((r, i) => {
        if (r.status === 'fulfilled')
          Object.assign(group[i]!, { ipa: r.value.ipa, ipaUs: r.value.ipa_us });
      });
      if (res.every((r) => r.status === 'rejected')) return; // FastAPI caído: no insistir línea por línea
    }
  }
}
