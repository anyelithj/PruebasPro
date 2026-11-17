import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { NounGrammarService } from '../../../../shared/noun-grammar/noun-grammar.service';
import { grammarNote, termWithArticle } from '../../../curriculum/domain/content/vocabulary-grammar';
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
    @Optional() private readonly nouns?: NounGrammarService, // [2026-11-16]: completa artículo/plural/género de lo escrito a mano
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
    const byLang = new Map(input.map((t) => [t.language, t]));
    const incomplete: PolyglotTerm[] = [];
    for (const [language, { text, grammar }] of byLang) {
      const current = await this.terms.findOneBy({ conceptId, language });
      if (current?.text === text && (grammar === undefined || current.grammar === grammar)) continue; // Sin cambios: se conserva IPA y revisión
      const saved = await this.terms.save(
        Object.assign(current ?? this.terms.create({ conceptId, language }), {
          text,
          grammar: grammar ?? '',
          ipa: '',
          ipaUs: null,
          reviewed: false,
          needsNativeReview: needsNativeReview(language),
        }),
      );
      if (c.kind === 'word' && !saved.grammar) incomplete.push(saved);
    }
    // [Regla obligatoria · 2026-11-16]: palabra sin artículo/plural/género → se corrige sola en segundo plano (la IA local tarda; no bloquea el guardado)
    if (incomplete.length && this.nouns) void this.completeGrammar(incomplete, token);
    try {
      await this.enrich.execute({ conceptIds: [conceptId] }, token);
    } catch {
      // [Degradación elegante]: los términos quedan guardados sin IPA (se reintenta con POST /polyglot/topics/:id/ipa)
    }
    return this.terms.find({ where: { conceptId }, order: { language: 'ASC' } });
  }

  // [completeGrammar]: un término por llamada (idiomas distintos) · fallo → queda como estaba | `Logger` en vez de tragar el error en silencio
  private async completeGrammar(list: PolyglotTerm[], token: string): Promise<void> {
    let retext = false;
    for (const t of list) {
      try {
        const [r] = await this.nouns!.many([t.text], t.language);
        const text = termWithArticle(t.language, t.text, r ?? null);
        const grammar = grammarNote(t.language, r ?? null);
        if (grammar || text !== t.text) await this.terms.update(t.id, { text, grammar, ...(text !== t.text ? { ipa: '', ipaUs: null } : {}) });
        retext ||= text !== t.text;
      } catch (err) {
        this.log.warn(`Gramática sin completar (${t.language} «${t.text}»): ${String(err)}`);
      }
    }
    // Término con artículo nuevo → IPA otra vez (sin revisar) | `.catch`: sin IA de IPA queda vacío, como al crear
    if (retext) await this.enrich.execute({ conceptIds: [list[0]!.conceptId] }, token).catch(() => undefined);
  }
  private readonly log = new Logger(UpsertTermsUseCase.name);
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
