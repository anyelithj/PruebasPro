import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { Language } from '../../../../shared/domain/language.vo';
import { GRAMMAR_STATUSES, type GrammarStatus } from '../../domain/entities/grammar-topic.entity';
import { SECTION_TYPES, type SectionType } from '../../domain/section-type';
// [DTOs Grammar · Sprints 10.9/10.10]: contratos de entrada de fichas, secciones, ejemplos y borradores — validados en la frontera | [Patrón]: DTO + Validation (class-validator) | [Principio]: Fail Fast | [Paradigma]: Declarativo (decoradores)

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class GrammarTopicBody {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) summary?: string;
  @IsOptional() @IsIn(GRAMMAR_STATUSES) status?: GrammarStatus;
}
export class UpdateGrammarTopicBody extends PartialType(GrammarTopicBody) {}

export class GrammarDraftBody {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
}

export class SectionBody {
  @IsIn(SECTION_TYPES) type!: SectionType;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) title?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000) body?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) position?: number;
}
export class UpdateSectionBody extends PartialType(SectionBody) {}

export class ExampleBody {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(600) text!: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) position?: number;
}

export class UpdateExampleBody {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(600) text?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(800) ipa?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(800) ipaUs?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(800) translation?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) position?: number;
}
