import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { VocabularyEntry } from '../../domain/entities/vocabulary-entry.entity';
import {
  isGrammarComplete,
  type GrammarSnapshot,
} from '../../domain/noun-grammar';
// [UseCase CompleteGrammar · 2026-11-03 · Regla obligatoria de vocabulario]: artículo/género/plural/clasificador de cada sustantivo vía FastAPI
// + reparación automática de las entradas guardadas incompletas | [Patrón]: Use Case + Fail Soft (IA caída → `checked=false`, se reintenta) | [Principio]: SRP

const REPAIR_BATCH = 5; // ponytail: 5 por listado (la IA tarda ~30 s por palabra); cola de trabajos si el banco crece mucho

@Injectable()
export class CompleteGrammarUseCase {
  private readonly logger = new Logger(CompleteGrammarUseCase.name);
  private readonly inFlight = new Set<string>(); // Evita reparar dos veces la misma entrada si el alumno recarga

  constructor(
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [snapshot]: nunca lanza → la entrada se guarda igual y queda pendiente
  async snapshot(term: string, language: string, token: string): Promise<GrammarSnapshot | null> {
    try {
      const r = await this.tools.nounGrammar(term, language, token);
      return { ...r.grammar, lemma: r.lemma, headword: r.headword, missing: r.missing, checked: r.checked };
    } catch (err) {
      this.logger.warn(`Gramática de «${term}» (${language}) no disponible: ${String(err)}`);
      return null;
    }
  }

  // [repairPending]: en segundo plano (no bloquea el listado) | las entradas corregidas a mano (`reviewed`) con gramática completa no se tocan
  repairPending(list: VocabularyEntry[], token: string): void {
    const pending = list.filter((e) => !isGrammarComplete(e.grammar) && !this.inFlight.has(e.id) && !(e.reviewed && e.grammar?.checked)).slice(0, REPAIR_BATCH);
    for (const e of pending) this.inFlight.add(e.id);
    void (async () => {
      for (const e of pending) {
        const g = await this.snapshot(e.term, e.language, token);
        if (g) await this.entries.update(e.id, { grammar: g as never }); // `as never`: TypeORM tipa jsonb como DeepPartial
        this.inFlight.delete(e.id);
      }
    })();
  }
}
