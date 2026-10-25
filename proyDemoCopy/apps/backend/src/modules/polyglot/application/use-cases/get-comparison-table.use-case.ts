import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { TopicCrudService } from '../../../../shared/application/topic-crud.service';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import type { PolyglotTopic } from '../../domain/entities/polyglot-topic.entity';
import { languageOrder } from '../../domain/language-order';
import { EnrichTermsUseCase } from './enrich-terms.use-case';
// [UseCases PolyglotTopicAccess + GetComparisonTable + GetConcept · Sprint 10.5 · RF-129 a RF-131]: tabla de un tema — una fila por concepto con su emoji o imagen y, por idioma pedido y en su orden, el término y su IPA | [Patrón]: Query (CQRS ligero) + Guard reutilizable + Pure Function (languageOrder) | [Principio]: SRP + mínimo privilegio (borradores solo para el personal) + DRY | [Paradigma]: POO + funcional

export const POLYGLOT_TOPICS = Symbol('POLYGLOT_TOPICS'); // TopicCrudService<PolyglotTopic> (useFactory en el módulo)

export interface PolyglotActor {
  id: string;
  role: string; // USER | TEACHER | ADMIN (del JWT)
}
export const isPolyglotStaff = (a: PolyglotActor): boolean =>
  a.role === 'TEACHER' || a.role === 'ADMIN';

@Injectable()
export class PolyglotTopicAccess {
  constructor(
    @Inject(POLYGLOT_TOPICS)
    private readonly topics: TopicCrudService<PolyglotTopic>,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
  ) {}

  // [readable]: publicado para todos; borrador solo para el personal («no existe» para el resto)
  async readable(actor: PolyglotActor, id: string): Promise<PolyglotTopic> {
    const t = await this.topics.get(id);
    if (t.status !== 'published' && !isPolyglotStaff(actor))
      throw new NotFoundException('Tema no encontrado');
    return t;
  }

  editable(actor: PolyglotActor, id: string): Promise<PolyglotTopic> {
    if (!isPolyglotStaff(actor))
      throw new ForbiddenException('Solo docentes y administradores');
    return this.topics.get(id);
  }

  // [concept]: el concepto y su tema activo (un tema archivado arrastra sus conceptos)
  async concept(id: string): Promise<PolyglotConcept> {
    const c = await this.concepts.findOneBy({ id });
    if (!c) throw new NotFoundException('Concepto no encontrado');
    await this.topics.get(c.topicId);
    return c;
  }
}

export interface TableCell {
  id: string;
  text: string;
  ipa: string;
  ipaUs: string | null;
  reviewed: boolean;
  needsNativeReview: boolean;
}

@Injectable()
export class GetComparisonTableUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
    private readonly enrich: EnrichTermsUseCase,
  ) {}

  // `token` (2026-10-19): JWT del usuario → si hay términos sin IPA se obtiene AL LEER (espeak-ng en FastAPI, determinista) y queda guardado
  // [Por qué]: los temas sembrados nacían sin IPA hasta que un docente pulsaba «Obtener IPA» → el alumno veía la tabla sin pronunciación | [Patrón]: Cache-Aside (lectura que completa y persiste)
  async execute(actor: PolyglotActor, topicId: string, languages?: string, token?: string) {
    const topic = await this.access.readable(actor, topicId);
    const order = languageOrder(languages);
    const concepts = await this.concepts.find({
      where: { topicId: topic.id },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    const where = { conceptId: In(concepts.map((c) => c.id)), language: In(order) };
    let terms = concepts.length ? await this.terms.find({ where }) : [];
    const missing = terms.filter((t) => !t.ipa && !t.reviewed);
    if (token && missing.length) {
      const r = await this.enrich.execute({ conceptIds: [...new Set(missing.map((t) => t.conceptId))] }, token);
      if (r.updated) terms = await this.terms.find({ where }); // FastAPI caído → se devuelve sin IPA (degradación elegante)
    }
    // `Map` (ES2015): «concepto|idioma» → término en O(1) al armar las filas
    const byKey = new Map(terms.map((t) => [`${t.conceptId}|${t.language}`, t]));
    return {
      topic,
      languages: order,
      rows: concepts.map((c) => ({
        concept: c,
        terms: Object.fromEntries(
          order.map((lang) => {
            const t = byKey.get(`${c.id}|${lang}`);
            const cell: TableCell | null = t
              ? {
                  id: t.id,
                  text: t.text,
                  ipa: t.ipa,
                  ipaUs: t.ipaUs,
                  reviewed: t.reviewed,
                  needsNativeReview: t.needsNativeReview,
                }
              : null; // Hueco: el docente aún no escribió el término
            return [lang, cell];
          }),
        ),
      })),
    };
  }
}

@Injectable()
export class GetConceptUseCase {
  constructor(
    private readonly access: PolyglotTopicAccess,
    @InjectRepository(PolyglotTerm)
    private readonly terms: Repository<PolyglotTerm>,
  ) {}

  async execute(actor: PolyglotActor, id: string) {
    const concept = await this.access.concept(id);
    await this.access.readable(actor, concept.topicId);
    return {
      ...concept,
      terms: await this.terms.find({
        where: { conceptId: id },
        order: { language: 'ASC' },
      }),
    };
  }
}
