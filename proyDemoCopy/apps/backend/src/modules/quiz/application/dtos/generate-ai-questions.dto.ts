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
    maxLength: 200,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
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
}
