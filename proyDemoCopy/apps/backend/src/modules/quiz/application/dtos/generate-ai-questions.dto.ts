import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Category } from '../../domain/value-objects/category.vo';
import { Difficulty } from '../../domain/value-objects/difficulty.vo';
import {
  DEFAULT_LANGUAGE,
  Language,
} from '../../domain/value-objects/language.vo';
import { QuestionType } from '../../domain/entities/question.entity';
import {
  AIProvider,
  DEFAULT_AI_PROVIDER,
} from '../../domain/value-objects/ai-provider.vo';
// [DTO Generate AI Questions]: input para motor AI (Qwen / Mistral) | [Patrón]: DTO | [Principio]: SRP + ISP

export class GenerateAIQuestionsDto {
  @ApiProperty({
    description: 'Tema libre de la práctica',
    example: 'Presente simple',
    minLength: 2,
    maxLength: 2000, // [2026-11-10]: todos los subtemas del curso
  })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  topic!: string;

  @ApiProperty({ default: 10, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  amount!: number;

  @ApiProperty({ enum: Category, required: false })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @ApiProperty({ enum: Difficulty, required: false })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiProperty({ enum: QuestionType, required: false })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiProperty({
    enum: Language,
    required: false,
    default: DEFAULT_LANGUAGE,
    description: 'Idioma objetivo',
  })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  // [Provider preferido]: si falla se aplica fallback automáticamente | [Patrón]: Strategy hint | [Principio]: OCP
  @ApiProperty({
    enum: AIProvider,
    required: false,
    default: DEFAULT_AI_PROVIDER,
  })
  @IsOptional()
  @IsEnum(AIProvider)
  provider?: AIProvider;

  // [sourceText · 2026-11-03]: texto extraído de un archivo o enlace (Word, PDF, imagen, página…) → las preguntas salen SOLO de este material | máx. 6000 = juegos
  @ApiProperty({ required: false, maxLength: 6000, description: 'Material importado del que salen las preguntas' })
  @IsOptional()
  @IsString()
  @MaxLength(6000)
  sourceText?: string;
}
