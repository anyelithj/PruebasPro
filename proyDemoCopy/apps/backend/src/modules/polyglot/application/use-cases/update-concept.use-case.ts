import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import type { UpdateConceptBody } from '../dtos/polyglot.dto';
import { imageProblem } from './add-concept.use-case';
import {
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
// [UseCase UpdateConcept · Sprint 10.5]: edita el concepto, su emoji, su imagen (con licencia) o su posición | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (imageProblem) | [Paradigma]: POO

@Injectable()
export class UpdateConceptUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
  ) {}

  async execute(
    actor: PolyglotActor,
    id: string,
    patch: UpdateConceptBody,
  ): Promise<PolyglotConcept> {
    const c = await this.access.concept(id);
    await this.access.editable(actor, c.topicId);
    Object.assign(
      c,
      Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ),
    );
    const problem = imageProblem(c);
    if (problem) throw new BadRequestException(problem);
    return this.concepts.save(c);
  }
}
