import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import { CurriculumItemKind } from '../../domain/value-objects/curriculum-item-kind.vo';
import { MAX_BATCH } from '../queries/ai-draft.queries';
// [DTOs del esquema del curso]: validan el árbol Nivel → Módulo → Unidad → Lección en la frontera HTTP | [Patrón]: DTO + Composite | [Principio]: Fail Fast + tipado seguro | [Tecnología]: class-validator + class-transformer + Swagger
// `@ValidateNested` + `@Type` (class-transformer): validan cada hijo con su propia clase (sin esto, los objetos anidados no se revisan)
// `@ArrayMaxSize`: límites de tamaño → un esquema no puede crecer sin control (protección de memoria y BD)

export class OutlineLessonDto {
  @ApiPropertyOptional({ description: 'Id del nodo existente (se actualiza y conserva el progreso)' })
  @IsOptional()
  @IsUUID()
  id?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiProperty({
    description:
      'Tema curricular: se reutilizan los recursos que ya tengan este tema',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  topic!: string;
  @ApiProperty({ enum: CurriculumItemKind })
  @IsEnum(CurriculumItemKind)
  kind!: CurriculumItemKind;
  @ApiProperty({ enum: LanguageSkill })
  @IsEnum(LanguageSkill)
  skill!: LanguageSkill;
}

export class OutlineUnitDto {
  @ApiPropertyOptional({ description: 'Id del nodo existente (se actualiza y conserva el progreso)' })
  @IsOptional()
  @IsUUID()
  id?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiProperty({ type: [OutlineLessonDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OutlineLessonDto)
  lessons!: OutlineLessonDto[];
}

export class OutlineModuleDto {
  @ApiPropertyOptional({ description: 'Id del nodo existente (se actualiza y conserva el progreso)' })
  @IsOptional()
  @IsUUID()
  id?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiProperty({ type: [OutlineUnitDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OutlineUnitDto)
  units!: OutlineUnitDto[];
}

export class OutlineLevelDto {
  @ApiPropertyOptional({ description: 'Id del nodo existente (se actualiza y conserva el progreso)' })
  @IsOptional()
  @IsUUID()
  id?: string;
  @ApiProperty({ enum: CefrLevel }) @IsEnum(CefrLevel) level!: CefrLevel;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
  @ApiProperty({ type: [OutlineModuleDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OutlineModuleDto)
  modules!: OutlineModuleDto[];
}

// [PUT /curriculum/courses/:courseId/outline]: el esquema completo del curso (reemplaza el anterior)
export class SaveCourseOutlineDto {
  @ApiProperty({ type: [OutlineLevelDto] })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => OutlineLevelDto) // Máx. 6 niveles (A1…C2)
  levels!: OutlineLevelDto[];
}

// [POST …/lessons/:lessonId/fill]: cuántos elementos generar si la lección está vacía
export class FillLessonGapDto {
  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: MAX_BATCH })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BATCH)
  count?: number;
}
