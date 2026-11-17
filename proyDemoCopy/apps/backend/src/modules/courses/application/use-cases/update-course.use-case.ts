import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { assertHasFinalExam } from '../policies/course-exam.policy';
import { resolveCourseGroup } from '../../domain/value-objects/course-category.vo';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { UpdateCourseDto } from '../dtos/update-course.dto';
import { CourseResponseDto } from '../dtos/course-response.dto';
import {
  assertCanManageCourse,
  type CourseActor,
} from '../policies/course-ownership.policy'; // [2026-10-27]: regla de propiedad compartida | [Principio]: DRY
import { CoursePrice } from '../../domain/value-objects/course-price.vo';
import { assertUniqueCourseTitle } from '../policies/course-title.policy'; // [2026-10-28]: regla anti-duplicados por título
// [UseCase UpdateCourse]: edición parcial de curso | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class UpdateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
    private readonly db: DataSource,
  ) {}

  async execute(
    id: string,
    patch: UpdateCourseDto,
    actor?: CourseActor, // [2026-10-27]: presente desde el controlador → el docente solo edita sus cursos
  ): Promise<CourseResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Curso ${id} no encontrado`);
    if (actor) assertCanManageCourse(existing, actor); // [Policy de propiedad]: 403 antes de validar nada más (Fail Fast)
    if (patch.isPublished && !existing.isPublished)
      await assertHasFinalExam(this.db, id); // [2026-11-10]: publicar exige examen final

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
      CoursePrice.validate(
        patch.price ?? Number(existing.price),
        patch.originalPrice !== undefined
          ? patch.originalPrice
          : existing.originalPrice !== null
            ? Number(existing.originalPrice)
            : null,
        patch.currency ?? existing.currency,
        (m) => new BadRequestException(m), // [Fix 2026-10-28]: 400 en vez de 500
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

    // [Fix 2026-10-28 · Sin duplicados]: cambio de título, idioma o nivel que choca con otro curso → 409 (el propio no cuenta)
    if (patch.title !== undefined || patch.category || patch.group) {
      let group: string = patch.group ?? existing.group;
      try {
        group = patch.category
          ? resolveCourseGroup(patch.category, patch.group ?? existing.group)
          : group;
      } catch {
        /* Ya validado arriba (400); aquí solo se usa el grupo resultante */
      }
      await assertUniqueCourseTitle(
        this.repo,
        patch.title ?? existing.title,
        group,
        patch.category ?? existing.category,
        id,
      );
    }

    const updated = await this.repo.update(id, patch);
    return CourseResponseDto.fromDomain(updated, null);
  }
}
