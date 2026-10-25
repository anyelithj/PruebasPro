import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { TopicCrudService } from '../../../../shared/application/topic-crud.service';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import { GrammarSection } from '../../domain/entities/grammar-section.entity';
import type { GrammarTopic } from '../../domain/entities/grammar-topic.entity';
// [UseCases GrammarAccess + GetGrammarTopic + ListSections + GetSection + ListExamples + GetExample · Sprint 10.9 · RF-133/RF-134]: lectura de fichas, secciones y ejemplos según el rol (borradores solo para el personal) | [Patrón]: Query (CQRS ligero) + Guard reutilizable | [Principio]: SRP + mínimo privilegio + DRY | [Paradigma]: POO + async/await

export const GRAMMAR_TOPICS = Symbol('GRAMMAR_TOPICS'); // TopicCrudService<GrammarTopic> (useFactory en el módulo)

export interface GrammarActor {
  id: string;
  role: string; // USER | TEACHER | ADMIN (del JWT)
}
export const isGrammarStaff = (a: GrammarActor): boolean =>
  a.role === 'TEACHER' || a.role === 'ADMIN';

@Injectable()
export class GrammarAccess {
  constructor(
    @Inject(GRAMMAR_TOPICS)
    private readonly topics: TopicCrudService<GrammarTopic>,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
  ) {}

  async readable(actor: GrammarActor, id: string): Promise<GrammarTopic> {
    const t = await this.topics.get(id);
    if (t.status !== 'published' && !isGrammarStaff(actor))
      throw new NotFoundException('Ficha no encontrada');
    return t;
  }

  editable(actor: GrammarActor, id: string): Promise<GrammarTopic> {
    if (!isGrammarStaff(actor))
      throw new ForbiddenException('Solo docentes y administradores');
    return this.topics.get(id);
  }

  async section(id: string): Promise<GrammarSection> {
    const s = await this.sections.findOneBy({ id });
    if (!s) throw new NotFoundException('Sección no encontrada');
    return s;
  }

  async example(id: string): Promise<{ example: GrammarExample; section: GrammarSection }> {
    const example = await this.examples.findOneBy({ id });
    if (!example) throw new NotFoundException('Ejemplo no encontrado');
    return { example, section: await this.section(example.sectionId) };
  }
}

@Injectable()
export class ListSectionsUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
  ) {}

  async execute(actor: GrammarActor, topicId: string): Promise<GrammarSection[]> {
    await this.access.readable(actor, topicId);
    return this.sections.find({ where: { topicId }, order: { position: 'ASC' } });
  }
}

@Injectable()
export class ListExamplesUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
  ) {}

  async execute(actor: GrammarActor, sectionId: string): Promise<GrammarExample[]> {
    const s = await this.access.section(sectionId);
    await this.access.readable(actor, s.topicId);
    return this.examples.find({ where: { sectionId }, order: { position: 'ASC' } });
  }
}

@Injectable()
export class GetSectionUseCase {
  constructor(
    private readonly access: GrammarAccess,
    private readonly examples: ListExamplesUseCase,
  ) {}

  async execute(actor: GrammarActor, id: string) {
    const s = await this.access.section(id);
    return { ...s, examples: await this.examples.execute(actor, id) };
  }
}

@Injectable()
export class GetExampleUseCase {
  constructor(private readonly access: GrammarAccess) {}

  async execute(actor: GrammarActor, id: string): Promise<GrammarExample> {
    const { example, section } = await this.access.example(id);
    await this.access.readable(actor, section.topicId);
    return example;
  }
}

// [GetGrammarTopic]: ficha completa con secciones y ejemplos en dos consultas (sin N+1)
@Injectable()
export class GetGrammarTopicUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
  ) {}

  async execute(actor: GrammarActor, id: string) {
    const topic = await this.access.readable(actor, id);
    const sections = await this.sections.find({
      where: { topicId: id },
      order: { position: 'ASC' },
    });
    const examples = sections.length
      ? await this.examples.find({
          where: { sectionId: In(sections.map((s) => s.id)) },
          order: { position: 'ASC' },
        })
      : [];
    return {
      ...topic,
      sections: sections.map((s) => ({
        ...s,
        examples: examples.filter((e) => e.sectionId === s.id),
      })),
    };
  }
}
