import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { resolveCourseGroup } from '../../domain/value-objects/course-category.vo';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { CreateCourseDto } from '../dtos/create-course.dto';
import { CourseResponseDto } from '../dtos/course-response.dto';
import { CoursePrice } from '../../domain/value-objects/course-price.vo';
import type { CourseActor } from '../policies/course-ownership.policy';
import { assertUniqueCourseTitle } from '../policies/course-title.policy'; // [2026-10-28]: regla anti-duplicados por título
// [UseCase CreateCourse]: alta administrativa de curso | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class CreateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  // [2026-10-27]: `actor?` (TS opcional) → quién crea el curso queda como dueño (`createdBy`); sin actor (seeds/tests) el curso no tiene dueño
  async execute(
    input: CreateCourseDto,
    actor?: CourseActor,
  ): Promise<CourseResponseDto> {
    // [Validación slug único]: ahorra colisión SQL | [Principio]: defensive
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictException(
        `Ya existe un curso con slug "${input.slug}"`,
      );
    }

    // [Validación de dominio VO]: forza invariantes price | [Principio]: SRP
    // [Fix 2026-10-28]: `validate` traduce la violación a 400 (antes: Error plano → 500 «Internal server error»)
    CoursePrice.validate(
      input.price ?? 0,
      input.originalPrice ?? null,
      input.currency ?? 'USD',
      (m) => new BadRequestException(m),
    );

    // [Invariante de dominio]: nivel MCER ⇒ idioma obligatorio; el error de dominio se traduce a HTTP 400 | [Patrón]: Domain Service
    let group;
    try {
      group = resolveCourseGroup(input.category, input.group);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    // [Fix 2026-10-28 · Sin duplicados]: mismo título (normalizado) en el mismo idioma + nivel → 409 antes de guardar
    await assertUniqueCourseTitle(
      this.repo,
      input.title,
      group,
      input.category,
    );

    const created = await this.repo.create({
      group,
      title: input.title,
      slug: input.slug,
      shortDescription: input.shortDescription,
      description: input.description ?? null,
      content: input.content ?? null, // [2026-10-24]: contenido Markdown del curso
      objectives: input.objectives ?? null,
      audience: input.audience ?? null,
      category: input.category,
      instructor: input.instructor,
      instructorTitle: input.instructorTitle ?? null,
      color: input.color ?? '#6366F1',
      icon: input.icon ?? '🌐',
      tags: input.tags ?? [],
      eje: input.eje ?? 1,
      lab: input.lab ?? null,
      price: input.price ?? 0,
      originalPrice: input.originalPrice ?? null,
      currency: input.currency ?? 'USD',
      durationHours: input.durationHours ?? 0,
      level: input.level ?? 'Intermedio',
      rating: input.rating ?? 0,
      studentsCount: input.studentsCount ?? 0,
      modality: input.modality ?? 'Online',
      isProBono: input.isProBono ?? false,
      isPublished: false, // [2026-11-10]: nace en borrador SIEMPRE → se publica cuando tenga examen final (SetPublished)
      createdBy: actor?.id ?? null, // [Propietario]: `?.` + `??` (ES2020) → null si no hay actor
    });

    return CourseResponseDto.fromDomain(created, null);
  }
}
