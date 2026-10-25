import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Category } from '../../domain/value-objects/category.vo';
import { Difficulty } from '../../domain/value-objects/difficulty.vo';
import {
  DEFAULT_LANGUAGE,
  Language,
} from '../../domain/value-objects/language.vo';
import { QuestionType } from '../../domain/entities/question.entity';
// [DTO Crear Quiz]: input POST /quiz | [Patrón]: DTO + Composite | [Principio]: SRP + ISP | [Paradigma]: Declarativo

export class QuestionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  // [Options]: array opcional (no aplica a true/false ni open)
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  correctAnswer!: string;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  // [Idioma override por pregunta]: usualmente null → hereda del quiz | [Principio]: ISP
  @ApiProperty({ enum: Language, required: false })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(5)
  timeLimitSeconds?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

export class CreateQuizDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: Category })
  @IsEnum(Category)
  category!: Category;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  // [Idioma del quiz completo]: aplica a todas las preguntas salvo override individual | [Patrón]: Default Policy | [Principio]: DRY
  @ApiProperty({ enum: Language, required: false, default: DEFAULT_LANGUAGE })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiProperty({ required: false, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  timePerQuestionSeconds?: number;

  // [Auto-publicar]: el seeder envía true; UI normal lo deja en false hasta revisión
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // [Preguntas]: 1+ requeridas, validadas anidadas con ValidateNested | [Patrón]: Composite
  @ApiProperty({ type: [QuestionDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Quiz requires at least one question' })
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}
