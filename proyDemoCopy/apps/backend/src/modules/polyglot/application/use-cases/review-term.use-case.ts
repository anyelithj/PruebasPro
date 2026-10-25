import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import type { ReviewTermBody } from '../dtos/polyglot.dto';
import {
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
import { GetTermUseCase } from './upsert-terms.use-case';
// [UseCase ReviewTerm · Sprint 10.5 · RF-132]: el docente corrige el término o su IPA (o lo confirma tal cual) y queda revisado; la corrección manual prevalece sobre la automática y cierra la revisión nativa | [Patrón]: Use Case (Command) | [Principio]: SRP + verificación humana | [Paradigma]: POO

@Injectable()
export class ReviewTermUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    private readonly get: GetTermUseCase,
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
  ) {}

  async execute(
    actor: PolyglotActor,
    id: string,
    patch: ReviewTermBody,
  ): Promise<PolyglotTerm> {
    const { term, topicId } = await this.get.load(id);
    await this.access.editable(actor, topicId);
    if (patch.text !== undefined) term.text = patch.text;
    if (patch.ipa !== undefined) term.ipa = patch.ipa;
    if (patch.ipaUs !== undefined && term.language === 'en')
      term.ipaUs = patch.ipaUs;
    term.reviewed = true;
    term.needsNativeReview = false;
    return this.terms.save(term);
  }
}
