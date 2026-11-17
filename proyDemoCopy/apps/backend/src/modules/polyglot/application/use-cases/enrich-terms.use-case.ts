import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { mapLimit } from '../../../../shared/background/background-tasks';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import { needsNativeReview } from '../../domain/language-order';
// [UseCase EnrichTerms · Sprint 10.5 · RF-130/RF-132]: obtiene el IPA de los términos sin revisar (FastAPI /language-tools/ipa, determinista: sin LLM); el inglés guarda UK y US; chino mandarín y ruso quedan marcados para revisión nativa | [Patrón]: Use Case (Command) + Ports & Adapters (LanguageToolsPort compartido) + degradación elegante | [Principio]: DIP + DRY + verificación humana | [Paradigma]: POO + async/await

const IPA_PARALLEL = 3; // Peticiones /ipa simultáneas (≈ procesos espeak-ng que FastAPI admite a la vez)

@Injectable()
export class EnrichTermsUseCase {
  private readonly logger = new Logger(EnrichTermsUseCase.name);

  constructor(
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [execute]: `scope` = conceptos concretos o un tema entero; `force` recalcula aunque ya tengan IPA (nunca los revisados)
  async execute(
    scope: { conceptIds?: string[]; topicId?: string },
    token: string,
    force = false,
  ): Promise<{ updated: number; failed: number }> {
    const ids =
      scope.conceptIds ??
      (
        await this.concepts.find({
          where: { topicId: scope.topicId },
          select: { id: true },
        })
      ).map((c) => c.id);
    if (!ids.length) return { updated: 0, failed: 0 };
    const pending = (
      await this.terms.find({
        where: { conceptId: In(ids), reviewed: false },
      })
    ).filter((t) => force || !t.ipa);
    // [2026-10-27 · Rendimiento]: antes en serie (una petición HTTP + un UPDATE por término: 7 idiomas × 15 conceptos ≈ 105 viajes encadenados)
    // → ahora IPA_PARALLEL peticiones a la vez (espeak-ng en FastAPI no usa el LLM y tiene su propio tope de procesos) y UN guardado en lote | [Patrón]: Bounded Parallelism + Batch Write
    const done = await mapLimit(pending, IPA_PARALLEL, async (t) => {
      try {
        const r = await this.tools.ipa(t.text, t.language, token);
        t.ipa = r.ipa;
        t.ipaUs = t.language === 'en' ? r.ipa_us : null;
        t.needsNativeReview = needsNativeReview(t.language);
        return t;
      } catch (err) {
        // El término queda sin IPA; se puede reintentar
        this.logger.warn(
          `IPA de «${t.text}» (${t.language}): ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    });
    const ok = done.filter((t): t is PolyglotTerm => t !== null); // Type guard (TS): solo los que obtuvieron IPA
    if (ok.length) await this.terms.save(ok); // `save([...])` (TypeORM): un viaje a la BD en vez de uno por término
    return { updated: ok.length, failed: pending.length - ok.length };
  }
}
