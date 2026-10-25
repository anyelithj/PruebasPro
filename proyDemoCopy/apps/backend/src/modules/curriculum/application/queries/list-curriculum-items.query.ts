import { Inject, Injectable } from '@nestjs/common';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
  type Paginated,
  type TopicGroup,
} from '../../domain/interfaces/curriculum.repository.interface';
import { STUDENT_VISIBLE_STATUSES } from '../../domain/value-objects/review-status.vo';
import { canManageCurriculum, type CurriculumActor } from '../curriculum-actor';
import type {
  CurriculumFilterDto,
  TopicLabelView,
} from '../dtos/curriculum-item.dto';
import { TopicLabelService } from '../topic-labels';
import { slugify } from '../../domain/slug';
// [Query ListCurriculumItems]: lectura paginada y filtrada; no modifica estado | [Patrón]: Query Handler (CQRS) | [Principio]: SRP + CQS (Command-Query Separation) | [Paradigma]: POO + async/await
// [Por qué CQRS aquí]: la lectura (filtros, visibilidad por rol, paginación) y la escritura (versiones, auditoría, máquina de estados)
// tienen reglas distintas. Se separan en clases, SIN bus ni event store → claridad sin infraestructura extra (ver ADR 0003).

@Injectable()
export class ListCurriculumItemsQuery {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  async execute(
    filter: CurriculumFilterDto,
    actor: CurriculumActor,
  ): Promise<Paginated<CurriculumItem>> {
    return this.repo.search({
      ...criteria(filter, actor),
      page: filter.page ?? 1, // Paginación con límites → consultas acotadas
      limit: filter.limit ?? 20,
    });
  }
}

// [criteria]: filtros + visibilidad por rol, compartidos por listado y agrupación | [Principio]: DRY + Least Privilege | [Paradigma]: Funcional (pura)
function criteria(filter: CurriculumFilterDto, actor: CurriculumActor) {
  // [Visibilidad por rol]: el estudiante SOLO ve contenido aprobado, aunque pida otro estado
  const statuses = canManageCurriculum(actor)
    ? filter.status
      ? [filter.status] // Docente/admin filtrando por un estado concreto
      : undefined // Docente/admin sin filtro: todos los estados
    : STUDENT_VISIBLE_STATUSES;
  return {
    language: filter.language,
    level: filter.level,
    skill: filter.skill,
    kind: filter.kind,
    provenance: filter.provenance,
    statuses,
    search: filter.search?.trim() || undefined,
    topic: filter.topic?.trim() || undefined,
  };
}

// [Query ListTopicGroups]: /resources agrupado por tema (una tarjeta por tema) + nombre del tema en el idioma | [Patrón]: Query Handler (CQRS) + Read Model
@Injectable()
export class ListTopicGroupsQuery {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
    private readonly labels: TopicLabelService,
  ) {}

  async execute(
    filter: CurriculumFilterDto,
    actor: CurriculumActor,
  ): Promise<Array<TopicGroup & { label: TopicLabelView | null }>> {
    const groups = await this.repo.groupByTopic(
      criteria(filter, actor),
      filter.perKind,
    );
    const labels = await this.labels.many(groups); // Una sola consulta para todos los grupos
    return groups.map((g) => ({
      ...g,
      label: labels.get(`${g.language}|${slugify(g.topic)}`) ?? null,
    }));
  }
}
