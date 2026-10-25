import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { CurriculumTopic } from '../../domain/entities/curriculum-topic.entity';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { slugify } from '../../domain/slug';
import type { CurriculumActor } from '../curriculum-actor';
import type { CreateTopicDto } from '../dtos/curriculum-item.dto';
// [Command CreateTopic]: alta de tema con slug generado en backend y control de duplicados (sin LLM)

@Injectable()
export class CreateTopicCommand {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  async execute(
    dto: CreateTopicDto,
    actor: CurriculumActor,
  ): Promise<CurriculumTopic> {
    const name = dto.name.trim();
    const slug = slugify(name); // Determinista: "Présent composé" → "present-compose"
    if (!slug) {
      throw new BadRequestException(
        'El nombre no genera una clave válida: incluye letras latinas o cirílicas',
      );
    }
    // [Tema equivalente]: mismo slug en la misma combinación idioma/nivel/competencia
    const existing = await this.repo.findTopic(
      dto.language,
      dto.level,
      dto.skill,
      slug,
    );
    if (existing) {
      throw new ConflictException(
        `Ya existe el tema "${existing.name}" para ese idioma, nivel y competencia`,
      );
    }
    if (dto.parentId && !(await this.repo.findTopicById(dto.parentId))) {
      throw new BadRequestException('El tema padre no existe');
    }
    return this.repo.createTopic({
      name,
      slug,
      language: dto.language,
      level: dto.level,
      skill: dto.skill,
      kind: dto.kind ?? null,
      parentId: dto.parentId ?? null,
      createdBy: actor.id,
    });
  }
}
