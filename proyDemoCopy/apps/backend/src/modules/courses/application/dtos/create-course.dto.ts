import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ACTIVE_COURSE_GROUPS,
  CourseCategory,
  CourseGroup,
} from '../../domain/value-objects/course-category.vo';
// [DTO CreateCourse]: input ADMIN para alta de curso | [Patrón]: DTO + Validation Pipeline | [Principio]: SRP

export class CreateCourseDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ maxLength: 220, description: 'Slug URL-friendly único' })
  @IsString()
  @Length(1, 220)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message:
      'slug debe ser lower-case con guiones (ej: diplomado-i-neurobiologia)',
  })
  slug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  shortDescription!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ enum: CourseCategory, description: 'Nivel MCER (A1–C2)' })
  @IsEnum(CourseCategory)
  category!: CourseCategory;

  // [Idioma del curso]: obligatorio para niveles MCER; `@IsIn` (class-validator) restringe a grupos vigentes | [Patrón]: Validation Pipeline
  @ApiPropertyOptional({
    enum: ACTIVE_COURSE_GROUPS,
    description: 'Idioma del curso',
  })
  @IsOptional()
  @IsIn(ACTIVE_COURSE_GROUPS)
  group?: CourseGroup;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  instructor!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  instructorTitle?: string | null;

  @ApiPropertyOptional({ default: '#1B7EC8' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6,8}$/, {
    message: 'color debe ser HEX (#RRGGBB o #RRGGBBAA)',
  })
  color?: string;

  @ApiPropertyOptional({ default: '🎓' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  eje?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lab?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  originalPrice?: number | null;

  @ApiPropertyOptional({ default: 'USD', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationHours?: number;

  @ApiPropertyOptional({ default: 'Intermedio' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  level?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  studentsCount?: number;

  @ApiPropertyOptional({ default: 'Online' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  modality?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isProBono?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
