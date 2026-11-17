import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Language } from '../../../../shared/domain/language.vo';
import { CEFR_LEVELS, CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { CONCEPT_KINDS, type ConceptKind } from '../../domain/entities/polyglot-concept.entity';
import {
  POLYGLOT_TOPIC_STATUSES,
  type PolyglotTopicStatus,
  POLYGLOT_CATEGORIES,
  type PolyglotCategory,
} from '../../domain/entities/polyglot-topic.entity';
// [DTOs Polyglot · Sprints 10.5/10.6]: contratos de entrada de temas, conceptos, términos, vistas guardadas y borradores — validados en la frontera | [Patrón]: DTO + Validation (class-validator) | [Principio]: Fail Fast | [Paradigma]: Declarativo (decoradores)

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PolyglotTopicBody {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(16) emoji?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsIn(POLYGLOT_TOPIC_STATUSES) status?: PolyglotTopicStatus;
  @IsOptional() @IsIn(POLYGLOT_CATEGORIES) category?: PolyglotCategory; // [2026-10-19]: vocabulario, frases, números, gramática u otros
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsIn(CEFR_LEVELS, { each: true }) levels?: CefrLevel[]; // [2026-11-11]: nivel del tema (vacío = todos)
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsEnum(Language, { each: true }) languages?: Language[]; // [2026-11-11]: idiomas que compara (vacío = los siete)
}
export class UpdatePolyglotTopicBody extends PartialType(PolyglotTopicBody) {}

export class ConceptBody {
  @IsOptional() @IsIn(CONCEPT_KINDS) kind?: ConceptKind;
  @IsOptional() @IsString() @MaxLength(16) emoji?: string;
  // [2026-11-11]: enlace https o imagen adjunta (data URL PNG/JPG/WebP/GIF ≤ 150 000 caracteres, = MAX_IMAGE_CHARS de Recursos)
  @IsOptional() @MaxLength(150_000) @Matches(/^(https:\/\/\S+|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/, { message: 'La imagen debe ser un enlace https o un archivo PNG, JPG, WebP o GIF' }) imageUrl?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) imageLicense?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) gloss?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10000) position?: number;
}
export class UpdateConceptBody extends PartialType(ConceptBody) {}

export class TermBody {
  @IsEnum(Language) language!: Language;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) text!: string;
  // [2026-11-16]: nota gramatical (plural, género, clasificador); sin ella NestJS la completa en segundo plano
  @IsOptional() @IsString() @MaxLength(160) grammar?: string;
}

export class TermsBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => TermBody)
  terms!: TermBody[];
}

export class ReviewTermBody {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) text?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) ipa?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) ipaUs?: string;
}

export class ViewBody {
  @IsUUID() topicId!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) name?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsEnum(Language, { each: true })
  languages!: Language[];
}
export class UpdateViewBody extends PartialType(ViewBody) {}

export class PolyglotDraftBody {
  @IsOptional() @IsIn(CONCEPT_KINDS) kind?: ConceptKind;
  @IsOptional() @IsInt() @Min(1) @Max(15) count?: number;
  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(7) @IsEnum(Language, { each: true }) languages?: Language[]; // [2026-11-11]: idiomas elegidos (omitido = los siete)
}
