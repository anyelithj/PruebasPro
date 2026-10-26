import { ApiProperty } from '@nestjs/swagger';
import { Course } from '../../domain/entities/course.entity';
import { CourseEnrollment } from '../../domain/entities/course-enrollment.entity';
import {
  CourseCategory,
  CourseGroup,
  courseCategoryLabel,
} from '../../domain/value-objects/course-category.vo';
import { CoursePrice } from '../../domain/value-objects/course-price.vo';
// [DTO CourseResponse]: forma uniforme de respuesta GET /courses | [Patrón]: DTO + Mapper | [Principio]: SRP

export class CourseResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() shortDescription!: string;
  @ApiProperty({ required: false, nullable: true }) description!: string | null;
  // [Contenido Markdown · 2026-10-24]: solo llega en el DETALLE (los listados no seleccionan la columna) → null en listados
  @ApiProperty({ required: false, nullable: true }) content!: string | null;
  @ApiProperty({ required: false, nullable: true }) objectives!: string | null;
  @ApiProperty({ required: false, nullable: true }) audience!: string | null;

  @ApiProperty({ enum: CourseCategory }) category!: CourseCategory;
  @ApiProperty() categoryLabel!: string;
  @ApiProperty({ enum: CourseGroup }) group!: CourseGroup;

  @ApiProperty() instructor!: string;
  @ApiProperty({ required: false, nullable: true }) instructorTitle!:
    | string
    | null;

  @ApiProperty() color!: string;
  @ApiProperty() icon!: string;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ minimum: 1, maximum: 5 }) eje!: number;
  @ApiProperty({ required: false, nullable: true }) lab!: string | null;

  @ApiProperty() price!: number;
  @ApiProperty({ required: false, nullable: true }) originalPrice!:
    | number
    | null;
  @ApiProperty() currency!: string;
  @ApiProperty() isFree!: boolean;
  @ApiProperty({ description: 'Equivalencia en TNA tokens (1 USD = 8 TNA)' })
  tokens!: number;
  @ApiProperty({ description: 'Porcentaje de descuento aplicado' })
  discountPercent!: number;

  @ApiProperty() durationHours!: number;
  @ApiProperty() level!: string;
  @ApiProperty() rating!: number;
  @ApiProperty() studentsCount!: number;
  @ApiProperty() modality!: string;
  @ApiProperty() isProBono!: boolean;
  @ApiProperty() isPublished!: boolean;

  // [Estado del usuario]: solo si hay sesión activa | [Principio]: SSOT — se popula desde enrollment
  @ApiProperty({ description: 'Progreso 0..100 del usuario actual' })
  progress!: number;
  @ApiProperty() isFavorite!: boolean;
  @ApiProperty() likeOn!: boolean;
  @ApiProperty() loveOn!: boolean;
  // [Acceso al material]: gratis o comprado → puede ver videos/PDF (el ADMIN siempre accede, lo resuelve el caso de uso de materiales)
  @ApiProperty({
    description: 'El usuario compró o se inscribió → puede ver el material',
  })
  hasAccess!: boolean;
  @ApiProperty({
    type: [String],
    description: 'Materiales completados (línea de tiempo)',
  })
  completedMaterialIds!: string[];

  @ApiProperty({
    type: [String],
    description: 'Subtemas del temario estudiados',
  })
  completedTopics!: string[];

  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  // [Mapper]: course (+ enrollment opcional) → DTO | [Patrón]: Mapper | [Principio]: SRP
  static fromDomain(
    course: Course,
    enrollment: CourseEnrollment | null = null,
  ): CourseResponseDto {
    const price = CoursePrice.create(
      Number(course.price),
      course.originalPrice !== null ? Number(course.originalPrice) : null,
      course.currency,
    );
    const dto = new CourseResponseDto();
    dto.id = course.id;
    dto.title = course.title;
    dto.slug = course.slug;
    dto.shortDescription = course.shortDescription;
    dto.description = course.description;
    dto.content = course.content ?? null; // `??` (ES2020): columna no seleccionada (listados) → null
    dto.objectives = course.objectives ?? null;
    dto.audience = course.audience ?? null;
    dto.category = course.category;
    dto.categoryLabel = courseCategoryLabel(course.category, course.group);
    dto.group = course.group;
    dto.instructor = course.instructor;
    dto.instructorTitle = course.instructorTitle;
    dto.color = course.color;
    dto.icon = course.icon;
    dto.tags = course.tags ?? [];
    dto.eje = course.eje;
    dto.lab = course.lab;
    dto.price = Number(course.price);
    dto.originalPrice =
      course.originalPrice !== null ? Number(course.originalPrice) : null;
    dto.currency = course.currency;
    dto.isFree = price.isFree;
    dto.tokens = price.tokens;
    dto.discountPercent = price.discountPercent;
    dto.durationHours = course.durationHours;
    dto.level = course.level;
    dto.rating = Number(course.rating);
    dto.studentsCount = course.studentsCount;
    dto.modality = course.modality;
    dto.isProBono = course.isProBono;
    dto.isPublished = course.isPublished;
    dto.progress = enrollment?.progress ?? 0;
    dto.isFavorite = enrollment?.isFavorite ?? false;
    dto.likeOn = enrollment?.reactionLike ?? false;
    dto.loveOn = enrollment?.reactionLove ?? false;
    dto.hasAccess = Boolean(enrollment?.purchasedAt); // `Boolean()` (JS): compra o inscripción (también en gratuitos)
    dto.completedMaterialIds = enrollment?.completedMaterialIds ?? [];
    dto.completedTopics = enrollment?.completedTopics ?? [];
    dto.createdAt = course.createdAt.toISOString();
    dto.updatedAt = course.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedCoursesResponseDto {
  @ApiProperty({ type: [CourseResponseDto] }) data!: CourseResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
