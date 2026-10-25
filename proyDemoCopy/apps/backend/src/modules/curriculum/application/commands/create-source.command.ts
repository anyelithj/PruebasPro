import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { CurriculumSource } from '../../domain/entities/curriculum-source.entity';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { slugify } from '../../domain/slug';
import type { CreateSourceDto } from '../dtos/curriculum-item.dto';
// [Command CreateSource]: alta de fuente externa reutilizable; atribución por plantilla fija si no se indica (sin LLM)

// [Atribución por defecto]: texto determinista a partir de los datos registrados
export function defaultAttribution(
  name: string,
  license?: string | null,
): string {
  return `${name}. Material utilizado/adaptado según la licencia registrada${license ? ` (${license})` : ''}.`;
}

@Injectable()
export class CreateSourceCommand {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  async execute(dto: CreateSourceDto): Promise<CurriculumSource> {
    const name = dto.name.trim();
    const slug = slugify(name);
    if (!slug)
      throw new BadRequestException(
        'El nombre de la fuente no genera una clave válida',
      );
    const existing = await this.repo.findSourceBySlug(slug);
    if (existing)
      throw new ConflictException(`La fuente "${existing.name}" ya existe`);

    const clean = (v?: string) => v?.trim() || null; // "" → null
    return this.repo.createSource({
      name,
      slug,
      type: clean(dto.type),
      author: clean(dto.author),
      publisher: clean(dto.publisher),
      url: clean(dto.url),
      license: clean(dto.license),
      language: clean(dto.language),
      attribution:
        clean(dto.attribution) ?? defaultAttribution(name, clean(dto.license)),
      isOwnContent: false, // Solo la fuente sembrada "Contenido propio" es propia
    });
  }
}
