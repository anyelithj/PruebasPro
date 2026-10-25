import { Inject, Injectable } from '@nestjs/common';
import type { CurriculumSource } from '../../domain/entities/curriculum-source.entity';
import type { CurriculumTopic } from '../../domain/entities/curriculum-topic.entity';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import type {
  KeyCheckDto,
  SourceSearchDto,
  TopicSearchDto,
} from '../dtos/curriculum-item.dto';
// [Queries de catálogo]: búsqueda de temas y fuentes y comprobación de clave; solo lectura y sin LLM

@Injectable()
export class SearchTopicsQuery {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  execute(dto: TopicSearchDto): Promise<CurriculumTopic[]> {
    return this.repo.searchTopics({
      ...dto,
      search: dto.search?.trim() || undefined,
      limit: dto.limit ?? 20,
    });
  }
}

@Injectable()
export class SearchSourcesQuery {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  execute(dto: SourceSearchDto): Promise<CurriculumSource[]> {
    return this.repo.searchSources(
      dto.search?.trim() || undefined,
      dto.limit ?? 20,
    );
  }
}

// [Resultado]: disponibilidad + recurso en conflicto (para un mensaje claro en la UI)
export interface KeyCheckResult {
  available: boolean;
  conflict?: { id: string; topic: string };
}

@Injectable()
export class CheckKeyQuery {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  async execute(dto: KeyCheckDto): Promise<KeyCheckResult> {
    const clash = await this.repo.findByNaturalKey(
      dto.language,
      dto.kind,
      dto.key,
    );
    if (!clash || clash.id === dto.excludeId) return { available: true };
    return { available: false, conflict: { id: clash.id, topic: clash.topic } };
  }
}
