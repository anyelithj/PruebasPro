import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumGeneration } from '../../domain/entities/curriculum-generation.entity';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import type { CurriculumItemRevision } from '../../domain/entities/curriculum-item-revision.entity';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { STUDENT_VISIBLE_STATUSES } from '../../domain/value-objects/review-status.vo';
import { canManageCurriculum, type CurriculumActor } from '../curriculum-actor';
// [Query GetCurriculumItem]: detalle de un recurso; el historial de revisiones solo para quien gestiona contenido | [Patrón]: Query Handler (CQRS) | [Principio]: SRP + Least Privilege | [Paradigma]: POO + async/await

// `export interface` (TS): vista de lectura (read model) — ítem + historial opcional
export interface CurriculumItemView {
  item: CurriculumItem;
  revisions?: CurriculumItemRevision[]; // Ausente para estudiantes
  generation?: CurriculumGeneration | null; // [Trazabilidad IA]: solo para quien gestiona contenido
}

@Injectable()
export class GetCurriculumItemQuery {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
    @InjectRepository(CurriculumGeneration)
    private readonly generations: Repository<CurriculumGeneration>,
  ) {}

  async execute(
    id: string,
    actor: CurriculumActor,
  ): Promise<CurriculumItemView> {
    const item = await this.repo.findById(id);
    const manager = canManageCurriculum(actor); // Docente o admin
    // [Ocultación]: un estudiante recibe 404 (no 403) para contenido no aprobado → no revela su existencia
    if (
      !item ||
      (!manager && !STUDENT_VISIBLE_STATUSES.includes(item.reviewStatus))
    ) {
      throw new NotFoundException(`Recurso ${id} no encontrado`);
    }
    // [Carga bajo demanda]: el historial solo se consulta si el actor puede verlo → evita consultas innecesarias
    if (!manager) return { item };
    // `Promise.all` (ES2015): historial y traza en paralelo | la traza solo existe si el contenido vino de la IA
    const [revisions, generation] = await Promise.all([
      this.repo.listRevisions(id),
      item.generationId
        ? this.generations.findOne({ where: { id: item.generationId } })
        : Promise.resolve(null),
    ]);
    return { item, revisions, generation };
  }
}
