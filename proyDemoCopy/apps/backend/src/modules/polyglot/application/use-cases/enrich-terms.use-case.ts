import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import { needsNativeReview } from '../../domain/language-order';
// [UseCase EnrichTerms · Sprint 10.5 · RF-130/RF-132]: obtiene el IPA de los términos sin revisar (FastAPI /language-tools/ipa, determinista: sin LLM); el inglés guarda UK y US; chino mandarín y ruso quedan marcados para revisión nativa | [Patrón]: Use Case (Command) + Ports & Adapters (LanguageToolsPort compartido) + degradación elegante | [Principio]: DIP + DRY + verificación humana | [Paradigma]: POO + async/await

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
    let updated = 0;
    let failed = 0;
    // [Secuencial]: espeak-ng en FastAPI es rápido; en serie no satura el servicio con un tema grande
    for (const t of pending) {
      try {
        const r = await this.tools.ipa(t.text, t.language, token);
        t.ipa = r.ipa;
        t.ipaUs = t.language === 'en' ? r.ipa_us : null;
        t.needsNativeReview = needsNativeReview(t.language);
        await this.terms.save(t);
        updated++;
      } catch (err) {
        failed++; // El término queda sin IPA; se puede reintentar
        this.logger.warn(
          `IPA de «${t.text}» (${t.language}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { updated, failed };
  }
}
