import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import type { UpdateExampleBody } from '../dtos/grammar.dto';
import { EnrichExampleUseCase } from './enrich-example.use-case';
import { type GrammarActor, GrammarAccess } from './list-sections.use-case';
// [UseCase UpdateExample · Sprint 10.9 · RF-134]: corrige el texto, el IPA o la traducción; una corrección del IPA o la traducción prevalece (revisado) y un texto nuevo sin correcciones se vuelve a enriquecer | [Patrón]: Use Case (Command) | [Principio]: SRP + verificación humana + DRY | [Paradigma]: POO + async/await

@Injectable()
export class UpdateExampleUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
    private readonly enrich: EnrichExampleUseCase,
  ) {}

  async execute(
    actor: GrammarActor,
    id: string,
    patch: UpdateExampleBody,
    token: string,
  ): Promise<GrammarExample> {
    const { example, section } = await this.access.example(id);
    const topic = await this.access.editable(actor, section.topicId);
    const textChanged = patch.text !== undefined && patch.text !== example.text;
    const manual =
      patch.ipa !== undefined ||
      patch.ipaUs !== undefined ||
      patch.translation !== undefined;
    Object.assign(
      example,
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    );
    if (manual) example.reviewed = true; // La corrección del docente prevalece
    else if (textChanged) example.reviewed = false;
    await this.examples.save(example);
    if (textChanged && !manual)
      await this.enrich.execute([id], topic.language ?? 'en', token);
    return (await this.examples.findOneBy({ id })) ?? example;
  }
}
