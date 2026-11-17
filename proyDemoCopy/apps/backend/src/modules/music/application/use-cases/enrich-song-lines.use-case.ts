import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { Song } from '../../domain/entities/song.entity';
import { SongLine } from '../../domain/entities/song-line.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase EnrichSongLines · Sprints 9.1/9.2 · RF-117]: pide a FastAPI la traducción al español y el IPA de cada línea aún no revisada (la corrección manual del docente prevalece) | [Patrón]: Use Case (Command) + Ports & Adapters (LanguageToolsPort, el mismo cliente de Vocabulary) | [Principio]: DIP + DRY + verificación humana | [Paradigma]: POO + async/await
// [2026-10-24 · Bug «el servicio de IPA y traducción no respondió»]: antes UNA petición de hasta 80 líneas → FastAPI traducía verso a verso con el LLM en CPU, superaba los 90 s del cliente y se perdía todo (también el IPA, que es inmediato)
// Ahora: trozos de CHUNK líneas · un reintento por trozo · si el trozo sigue fallando, IPA solo (fonetizador determinista, sin LLM) · cada trozo se guarda al llegar (progreso parcial) | [Patrón]: Chunking + Retry + Fallback + Partial Success

export const ENRICH_CHUNK = 20; // Líneas por petición (FastAPI traduce cada trozo en una sola llamada al LLM)
const RETRIES = 1; // Reintentos por trozo (Ollama puede estar cargando el modelo la primera vez)
const IPA_PARALLEL = 4; // Peticiones de IPA simultáneas en el respaldo (espeak-ng es rápido; no saturar FastAPI)
// [Bug 2026-10-27 · «No se pudo contactar con el servidor» al cargar la letra]: toda la letra se enriquecía en UNA petición HTTP (trozos × reintento × 90 s) → con 60+ versos superaba los 300 s de `headersTimeout` del fetch (undici) del BFF de Next → 502 aunque NestJS seguía trabajando
// Ahora: presupuesto por petición → no se EMPIEZA otro trozo (ni otro reintento) pasado ENRICH_BUDGET_MS; la respuesta dice `more: true` y la UI vuelve a llamar a POST /lines/enrich (que sigue donde quedó) | [Patrón]: Deadline + Continuation (paginación por tiempo) | [Principio]: Fail Safe (peor caso ≈ presupuesto + 1 llamada de 90 s ≪ 300 s)
export const ENRICH_BUDGET_MS = 110_000;

// [EnrichOutcome]: líneas + cuántas siguen sin IPA o sin traducción (la UI ofrece reintentar en vez de un error genérico)
export interface EnrichOutcome {
  lines: SongLine[];
  missing: number; // 0 = todo enriquecido
  more: boolean; // [2026-10-27]: true = se agotó el presupuesto con versos sin intentar → la UI pide otra tanda
  unavailable: boolean; // [2026-10-27]: true = ningún trozo obtuvo respuesta del servicio de IA (FastAPI/Ollama caído) → la UI no insiste y lo dice
}

// [lacks]: ¿a la línea le falta algo automático? (español no se traduce) | Función pura
// [2026-11-06]: también versos revisados/manuales → lo que el docente dejó VACÍO se completa; lo escrito a mano no se pisa (ver enrichChunk)
export const lacks = (l: SongLine, language: string): boolean =>
  !l.ipa || (language !== 'es' && !l.translation);

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
    @InjectRepository(Song) private readonly songs?: Repository<Song>, // Opcional: las pruebas antiguas no la inyectan (sin glosa del título)
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
  // `budgetMs` (2026-10-27): tiempo máximo para EMPEZAR trozos en esta petición (los tests inyectan uno corto)
  async run(
    actor: MusicActor,
    songId: string,
    token: string,
    budgetMs = ENRICH_BUDGET_MS,
  ): Promise<EnrichOutcome> {
    const song = await this.access.editable(actor, songId);
    const deadline = Date.now() + budgetMs; // `Date.now()` (JS): milisegundos actuales → plazo absoluto
    const pending = (
      await this.lines.find({
        where: { songId },
        order: { position: 'ASC' },
      })
    )
      .filter((l) => lacks(l, song.language))
      // [Orden · 2026-10-27]: primero los versos nunca intentados (sin IPA) → cada tanda avanza aunque un trozo anterior falle siempre en la traducción | `sort` estable (ES2019): conserva el orden de posición
      .sort((a, b) => Number(!!a.ipa) - Number(!!b.ipa));
    let answered = 0; // Trozos que el servicio de IA respondió en esta petición
    let attempted = 0;
    let more = false;
    // `for...of` (ES2015) en secuencia: un trozo a la vez → el LLM local no recibe peticiones en paralelo
    for (const part of chunk(pending, ENRICH_CHUNK)) {
      // [Deadline]: el primer trozo siempre se intenta (garantiza avance); los siguientes solo si queda presupuesto
      if (attempted > 0 && Date.now() >= deadline) {
        more = true;
        break;
      }
      attempted++;
      if (await this.enrichChunk(part, song.language, token, deadline))
        answered++;
      else if (
        Date.now() < deadline &&
        (await this.ipaOnly(part, song.language, token))
      )
        answered++; // El respaldo de IPA también cuenta como «el servicio respondió»
      await this.lines.save(part); // Progreso parcial: lo ya enriquecido no se pierde si un trozo posterior falla
    }
    const all = await this.lines.find({
      where: { songId },
      order: { position: 'ASC' },
    });
    await this.glossTitle(song, all, token);
    const missing = all.filter((l) => lacks(l, song.language)).length;
    return {
      lines: all,
      missing,
      more: more && missing > 0,
      unavailable: attempted > 0 && answered === 0,
    };
  }

  // [fillTitleGloss · 2026-11-10 · «tarda en cargar la pronunciación y la traducción» del título]: canciones antiguas sin glosa guardada
  // → al abrirlas se calcula UNA vez en segundo plano y se guarda (la siguiente visita es instantánea) | `glossing`: sin llamadas duplicadas
  private readonly glossing = new Set<string>();
  async fillTitleGloss(songId: string, token: string): Promise<void> {
    if (!this.songs || this.glossing.has(songId)) return;
    this.glossing.add(songId);
    try {
      const song = await this.songs.findOneBy({ id: songId });
      if (song)
        await this.glossTitle(
          song,
          await this.lines.find({
            where: { songId },
            order: { position: 'ASC' },
          }),
          token,
        );
    } finally {
      this.glossing.delete(songId);
    }
  }

  // [glossTitle · 2026-11-10]: IPA + traducción del título una sola vez (si es un verso de la letra, se copia sin llamar a la IA) | fallo → queda vacío y la UI lo pide (Fail Soft)
  private async glossTitle(
    song: Song,
    lines: SongLine[],
    token: string,
  ): Promise<void> {
    if (
      !this.songs ||
      (song.titleIpa && (song.titleTranslation || song.language === 'es'))
    )
      return;
    const key = (t: string) =>
      t
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    const same = lines.find((l) => key(l.text) === key(song.title) && l.ipa);
    let gloss = same
      ? { ipa: same.ipa, translation: same.translation ?? '' }
      : null;
    if (!gloss) {
      try {
        // [2026-11-13 · Caso C]: un título NO se traduce como frase («Hands To Myself» → «Manos a mí») → IPA determinista + traducción «titulo»
        // (la recomendada: «No puedo contenerme») | `Promise.all` (ES2015): IPA y traducción en paralelo
        const [ipa, tr] = await Promise.all([
          this.tools.ipa(song.title, song.language, token),
          song.language === 'es'
            ? { translation: '' }
            : this.tools.translate(song.title, song.language, 'es', token, {
                kind: 'titulo',
              }),
        ]);
        gloss = { ipa: ipa.ipa ?? '', translation: tr.translation ?? '' };
      } catch (err) {
        this.logger.warn(
          `Glosa del título falló: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (!gloss) return;
    song.titleIpa = (song.titleIpa || gloss.ipa).slice(0, 300);
    song.titleTranslation = (song.titleTranslation || gloss.translation).slice(
      0,
      300,
    );
    await this.songs.update(song.id, {
      titleIpa: song.titleIpa,
      titleTranslation: song.titleTranslation,
    });
  }

  // [enrichChunk]: traducción + IPA con reintento; true si FastAPI respondió | [Patrón]: Retry
  private async enrichChunk(
    part: SongLine[],
    language: string,
    token: string,
    deadline = Infinity, // [2026-10-27]: pasado el plazo no se reintenta (el trozo queda para la siguiente tanda)
  ): Promise<boolean> {
    for (
      let attempt = 0;
      attempt <= RETRIES && (attempt === 0 || Date.now() < deadline);
      attempt++
    ) {
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
          // [2026-11-06]: lo ya escrito (a mano o en una tanda anterior) prevalece → solo se rellenan los campos vacíos
          Object.assign(l, {
            ipa: l.ipa || e.ipa,
            ipaUs: l.ipaUs || (e.ipa_us ?? l.ipaUs),
            translation: l.translation || (e.translation ?? l.translation),
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
  // `Promise<boolean>` (2026-10-27): true si al menos un verso obtuvo IPA → distingue «IA caída» de «IA lenta»
  private async ipaOnly(
    part: SongLine[],
    language: string,
    token: string,
  ): Promise<boolean> {
    let any = false;
    for (const group of chunk(
      part.filter((l) => !l.ipa),
      IPA_PARALLEL,
    )) {
      // `Promise.allSettled` (ES2020): un fallo no cancela el resto del grupo
      const res = await Promise.allSettled(
        group.map((l) => this.tools.ipa(l.text, language, token)),
      );
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          Object.assign(group[i]!, { ipa: r.value.ipa, ipaUs: r.value.ipa_us });
          any = true;
        }
      });
      if (res.every((r) => r.status === 'rejected')) return any; // FastAPI caído: no insistir línea por línea
    }
    return any;
  }
}
