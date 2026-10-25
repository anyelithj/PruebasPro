import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import type { ConceptBody } from '../dtos/polyglot.dto';
import {
  type PolyglotActor,
  PolyglotTopicAccess,
} from './get-comparison-table.use-case';
// [UseCase AddConcept · Sprint 10.5 · RF-129/RF-130]: agrega una palabra o frase al tema con su emoji o imagen; una imagen exige su licencia | [Patrón]: Use Case (Command) + Specification (imageProblem) | [Principio]: SRP + cumplimiento de derechos de autor | [Paradigma]: POO + funcional

// [imageProblem]: null = válido · texto = qué falta | Función pura (la usan AddConcept y UpdateConcept)
export const imageProblem = (c: {
  imageUrl?: string | null;
  imageLicense?: string | null;
}): string | null =>
  c.imageUrl && !c.imageLicense?.trim()
    ? 'Indica la licencia de la imagen (autor, fuente y licencia)'
    : null;

@Injectable()
export class AddConceptUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
  ) {}

  async execute(
    actor: PolyglotActor,
    topicId: string,
    body: ConceptBody,
  ): Promise<PolyglotConcept> {
    const topic = await this.access.editable(actor, topicId);
    const problem = imageProblem(body);
    if (problem) throw new BadRequestException(problem);
    // [Posición]: al final si no se indica (máximo actual + 1)
    const last = await this.concepts.findOne({
      where: { topicId: topic.id },
      order: { position: 'DESC' },
    });
    return this.concepts.save(
      this.concepts.create({
        topicId: topic.id,
        position: body.position ?? (last ? last.position + 1 : 0),
        kind: body.kind ?? 'word',
        emoji: body.emoji ?? '',
        imageUrl: body.imageUrl ?? null,
        imageLicense: body.imageLicense ?? null,
        gloss: body.gloss ?? '',
      }),
    );
  }
}
