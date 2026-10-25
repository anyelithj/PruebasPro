import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { resolveCourseGroup } from '../../domain/value-objects/course-category.vo';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { UpdateCourseDto } from '../dtos/update-course.dto';
import { CourseResponseDto } from '../dtos/course-response.dto';
import { CoursePrice } from '../../domain/value-objects/course-price.vo';
// [UseCase UpdateCourse]: edición parcial de curso | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class UpdateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  async execute(
    id: string,
    patch: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Curso ${id} no encontrado`);

    // [Validación slug único si cambia]: previene colisión | [Principio]: defensive
    if (patch.slug && patch.slug !== existing.slug) {
      const collision = await this.repo.findBySlug(patch.slug);
      if (collision && collision.id !== id) {
        throw new ConflictException(
          `Ya existe un curso con slug "${patch.slug}"`,
        );
      }
    }

    // [Validación de dominio VO]: revalida invariantes price si cambian | [Principio]: SRP
    if (
      patch.price !== undefined ||
      patch.originalPrice !== undefined ||
      patch.currency !== undefined
    ) {
      CoursePrice.create(
        patch.price ?? Number(existing.price),
        patch.originalPrice !== undefined
          ? patch.originalPrice
          : existing.originalPrice !== null
            ? Number(existing.originalPrice)
            : null,
        patch.currency ?? existing.currency,
      );
    }

    // [Invariante de dominio]: validar idioma↔nivel antes de persistir → error 400 claro en vez de 500 | [Patrón]: Domain Service
    if (patch.category) {
      try {
        resolveCourseGroup(patch.category, patch.group ?? existing.group);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }

    const updated = await this.repo.update(id, patch);
    return CourseResponseDto.fromDomain(updated, null);
  }
}
