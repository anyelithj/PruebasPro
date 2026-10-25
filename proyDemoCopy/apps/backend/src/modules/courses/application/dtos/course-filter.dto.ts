import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CourseCategory,
  CourseGroup,
} from '../../domain/value-objects/course-category.vo';
// [DTO CourseFilter]: query params para GET /courses | [Patrón]: DTO + Validation Pipeline | [Principio]: SRP

export class CourseFilterDto {
  @ApiPropertyOptional({
    enum: CourseGroup,
    description: 'Idioma del curso: EN, FR, DE, ES, PT, ZH, RU',
  })
  @IsOptional()
  @IsEnum(CourseGroup)
  group?: CourseGroup;

  @ApiPropertyOptional({ enum: CourseCategory, description: 'Nivel MCER' })
  @IsOptional()
  @IsEnum(CourseCategory)
  category?: CourseCategory;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    description: 'Eje formativo 1..5',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  eje?: number;

  @ApiPropertyOptional({ description: 'Búsqueda por título / instructor' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Solo cursos con becas ProBono' })
  @IsOptional()
  @IsBooleanString()
  isProBono?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;

  // [Helper bool]: convierte query string a boolean | [Principio]: DRY
  // `as` (TS): `obj` llega como any desde class-transformer → se acota al único campo que se lee
  @Transform(({ obj }) => (obj as { isProBono?: string }).isProBono === 'true')
  get isProBonoBool(): boolean | undefined {
    return this.isProBono === undefined ? undefined : this.isProBono === 'true';
  }
}
