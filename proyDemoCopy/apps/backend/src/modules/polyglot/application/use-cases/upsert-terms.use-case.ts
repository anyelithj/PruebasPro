import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import { needsNativeReview } from '../../domain/language-order';
import type { TermBody } from '../dtos/polyglot.dto';
import { EnrichTermsUseCase } from './enrich-terms.use-case';
import {
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
// [UseCases UpsertTerms + ListTerms + GetTerm · Sprint 10.5 · RF-130]: guarda los términos de un concepto en varios idiomas (uno por idioma: si existe se actualiza) y obtiene su IPA; un texto nuevo borra el IPA anterior y la revisión | [Patrón]: Use Case (Command) + Upsert + Query | [Principio]: SRP + DRY (EnrichTerms) | [Paradigma]: POO + async/await

@Injectable()
export class UpsertTermsUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
    private readonly enrich: EnrichTermsUseCase,
  ) {}

  async execute(
    actor: PolyglotActor,
    conceptId: string,
    input: TermBody[],
    token: string,
  ): Promise<PolyglotTerm[]> {
    const c = await this.access.concept(conceptId);
    await this.access.editable(actor, c.topicId);
    // `Map` (ES2015): el último término de cada idioma gana (sin duplicados en la misma petición)
    const byLang = new Map(input.map((t) => [t.language, t.text]));
    for (const [language, text] of byLang) {
      const current = await this.terms.findOneBy({ conceptId, language });
      if (current?.text === text) continue; // Sin cambios: se conserva IPA y revisión
      await this.terms.save(
        Object.assign(current ?? this.terms.create({ conceptId, language }), {
          text,
          ipa: '',
          ipaUs: null,
          reviewed: false,
          needsNativeReview: needsNativeReview(language),
        }),
      );
    }
    try {
      await this.enrich.execute({ conceptIds: [conceptId] }, token);
    } catch {
      // [Degradación elegante]: los términos quedan guardados sin IPA (se reintenta con POST /polyglot/topics/:id/ipa)
    }
    return this.terms.find({ where: { conceptId }, order: { language: 'ASC' } });
  }
}

@Injectable()
export class ListTermsUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
  ) {}

  async execute(actor: PolyglotActor, conceptId: string) {
    const c = await this.access.concept(conceptId);
    await this.access.readable(actor, c.topicId);
    return this.terms.find({ where: { conceptId }, order: { language: 'ASC' } });
  }
}

@Injectable()
export class GetTermUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
  ) {}

  // [load]: el término y su concepto (lo reutilizan ReviewTerm y RemoveTerm)
  async load(id: string): Promise<{ term: PolyglotTerm; topicId: string }> {
    const term = await this.terms.findOneBy({ id });
    if (!term) throw new NotFoundException('Término no encontrado');
    const c = await this.access.concept(term.conceptId);
    return { term, topicId: c.topicId };
  }

  async execute(actor: PolyglotActor, id: string): Promise<PolyglotTerm> {
    const { term, topicId } = await this.load(id);
    await this.access.readable(actor, topicId);
    return term;
  }
}
