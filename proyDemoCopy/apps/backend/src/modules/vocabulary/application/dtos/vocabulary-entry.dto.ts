import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Language } from '../../../../shared/domain/language.vo';
import {
  WORD_STATUSES,
  type WordStatus,
} from '../../domain/entities/vocabulary-entry.entity';
// [DTOs Vocabulary · Sprint 8.2]: contratos de entrada del banco de vocabulario y de las consultas | [Patrón]: DTO (class-validator) | [Principio]: Fail Fast (validación en la frontera) + SRP | [Paradigma]: Declarativo (decoradores)

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateVocabularyEntryDto {
  @IsEnum(Language) language!: Language;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) term!: string;
  // [Opcionales]: si faltan, se completan con la consulta (traducción + IPA automáticos)
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  translation?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) example?: string;
  @IsOptional() @IsUUID() sourceItemId?: string;
}

export class UpdateVocabularyEntryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  translation?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) ipaUk?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) ipaUs?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) ipa?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) example?: string;
}

export class LookupTermDto {
  @IsEnum(Language) language!: Language;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) text!: string;
}

// [2026-10-19]: título de un tema (en español) → su versión en el idioma estudiado con IPA
export class TopicTitleDto {
  @IsEnum(Language) language!: Language;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) topic!: string;
}

// [Sprint 2.5]: traducción de un trozo del lector de PDF cuando el navegador no tiene Translator API (≤ 500 = límite de FastAPI)
export class TranslateTextDto {
  @IsEnum(Language) source!: Language;
  @IsEnum(Language) target!: Language;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) text!: string;
}

export class LookupWordDto {
  @IsEnum(Language) language!: Language;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) word!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(400) sentence?: string;
}

// [Sprint 10.2 · RF-137]: «Aprender» desde el diccionario — la palabra, la frase donde apareció y lo que ya mostró la ventana
export class MarkWordDto {
  @IsEnum(Language) language!: Language;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) word!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) translation?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) sentence?: string; // Se guarda como ejemplo
}

export class WordStatusDto {
  @IsIn(WORD_STATUSES) status!: WordStatus;
}
