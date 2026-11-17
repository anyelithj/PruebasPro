import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import {
  chunk,
  ENRICH_CHUNK,
} from '../../../music/application/use-cases/enrich-song-lines.use-case';
import { mapLimit } from '../../../../shared/background/background-tasks';
import { sanitizeTranslation } from '../../domain/translation-sanitizer';
// [TurnEnricher · 2026-10-23]: IPA + traducción de varios turnos en una petición a LanguageTools | archivo propio para cortar el ciclo
// get-dialogue ↔ add-turn (SWC evalúa los metadatos de decoradores al cargar → «Cannot access 'TurnEnricher' before initialization»)
// [Patrón]: Ports & Adapters + degradación elegante | [Principio]: SRP + DRY (subida, conversación, biblioteca) + DIP | [Paradigma]: POO + async/await
// [Bug · 2026-10-27 · «los diálogos se crean sin IPA ni traducción»]: antes UNA petición con TODOS los turnos → con el LLM local en CPU superaba los 90 s del cliente,
// fallaba entera y se guardaba todo vacío (también el IPA, que es inmediato). Ahora: MISMA estrategia que la letra de las canciones (EnrichSongLines) →
// trozos de ENRICH_CHUNK turnos + respaldo de solo IPA (espeak-ng, sin LLM) por trozo fallido | [Patrón]: Chunking + Fallback + Partial Success | [Principio]: DRY (`chunk`/`ENRICH_CHUNK` de Music)

export interface TurnLinguistics {
  ipa: string;
  ipaUs: string | null;
  translation: string | null;
}

const EMPTY: TurnLinguistics = { ipa: '', ipaUs: null, translation: null };
const IPA_PARALLEL = 4; // = Música: espeak-ng es rápido, pero no se satura FastAPI

@Injectable()
export class TurnEnricher {
  private readonly logger = new Logger(TurnEnricher.name);

  constructor(
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [enrich]: misma longitud y orden que `texts` · nunca lanza (lo que falte se completa luego: GetDialogue lo rellena al abrir o se corrige a mano)
  async enrich(
    texts: string[],
    language: string,
    token: string,
    context = '', // [2026-11-13]: conversación previa → traducción con sentido (no se traduce)
  ): Promise<TurnLinguistics[]> {
    const out: TurnLinguistics[] = [];
    // `for…of` secuencial: un trozo a la vez → el LLM local no recibe peticiones en paralelo
    for (const part of chunk(texts, ENRICH_CHUNK)) {
      out.push(...(await this.enrichChunk(part, language, token, context)));
    }
    return out;
  }

  // [enrichChunk]: traducción + IPA del trozo; si FastAPI/Ollama falla → solo IPA (determinista) para no dejar el turno vacío
  private async enrichChunk(
    texts: string[],
    language: string,
    token: string,
    context = '',
  ): Promise<TurnLinguistics[]> {
    try {
      const res = await this.tools.lines(texts, language, token, context);
      // [Alineación por índice]: FastAPI devuelve `index` por línea → se respeta aunque omita alguna | `Map` (ES2015)
      const byIndex = new Map(res.lines.map((l) => [l.index, l]));
      // [2026-10-25]: `sanitizeTranslation` → nunca se guarda JSON crudo ni «yes» → «yes» (null = la UI muestra «—»)
      return texts.map((text, i) => {
        const l = byIndex.get(i);
        return l
          ? {
              ipa: l.ipa ?? '',
              ipaUs: l.ipa_us ?? null,
              translation: sanitizeTranslation(text, l.translation),
            }
          : EMPTY;
      });
    } catch (err) {
      this.logger.warn(
        `Turnos sin traducción (${texts.length}); se intenta solo el IPA: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.ipaOnly(texts, language, token);
    }
  }

  // [ipaOnly]: respaldo sin LLM | `mapLimit` (BackgroundTasks): máx. IPA_PARALLEL peticiones a la vez · cada fallo → turno vacío (no cancela el resto)
  private ipaOnly(
    texts: string[],
    language: string,
    token: string,
  ): Promise<TurnLinguistics[]> {
    return mapLimit(texts, IPA_PARALLEL, (t) =>
      this.tools
        .ipa(t, language, token)
        .then(
          (r): TurnLinguistics => ({
            ipa: r.ipa,
            ipaUs: r.ipa_us,
            translation: null,
          }),
        )
        .catch(() => EMPTY),
    );
  }
}
