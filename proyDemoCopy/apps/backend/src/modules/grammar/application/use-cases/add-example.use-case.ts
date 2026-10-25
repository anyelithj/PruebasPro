import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import type { ExampleBody } from '../dtos/grammar.dto';
import { EnrichExampleUseCase } from './enrich-example.use-case';
import { type GrammarActor, GrammarAccess } from './list-sections.use-case';
// [UseCase AddExample · Sprint 10.9 · RF-134]: agrega un ejemplo a la sección y obtiene su IPA y su traducción al español | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (EnrichExample) | [Paradigma]: POO + async/await

@Injectable()
export class AddExampleUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
    private readonly enrich: EnrichExampleUseCase,
  ) {}

  async execute(
    actor: GrammarActor,
    sectionId: string,
    body: ExampleBody,
    token: string,
  ): Promise<GrammarExample> {
    const section = await this.access.section(sectionId);
    const topic = await this.access.editable(actor, section.topicId);
    const last = await this.examples.findOne({
      where: { sectionId },
      order: { position: 'DESC' },
    });
    const saved = await this.examples.save(
      this.examples.create({
        sectionId,
        text: body.text,
        position: body.position ?? (last ? last.position + 1 : 0),
        ipa: '',
        ipaUs: null,
        translation: null,
        reviewed: false,
      }),
    );
    await this.enrich.execute([saved.id], topic.language ?? 'en', token);
    return (await this.examples.findOneBy({ id: saved.id })) ?? saved;
  }
}
