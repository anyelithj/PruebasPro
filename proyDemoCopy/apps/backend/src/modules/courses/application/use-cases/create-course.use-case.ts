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
// [UseCase CreateCourse]: alta administrativa de curso | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class CreateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  async execute(input: CreateCourseDto): Promise<CourseResponseDto> {
    // [Validación slug único]: ahorra colisión SQL | [Principio]: defensive
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictException(
        `Ya existe un curso con slug "${input.slug}"`,
      );
    }

    // [Validación de dominio VO]: forza invariantes price | [Principio]: SRP
    CoursePrice.create(
      input.price ?? 0,
      input.originalPrice ?? null,
      input.currency ?? 'USD',
    );

    // [Invariante de dominio]: nivel MCER ⇒ idioma obligatorio; el error de dominio se traduce a HTTP 400 | [Patrón]: Domain Service
    let group;
    try {
      group = resolveCourseGroup(input.category, input.group);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

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
      isPublished: input.isPublished ?? true,
    });

    return CourseResponseDto.fromDomain(created, null);
  }
}
