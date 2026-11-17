import type { TextKind } from '../../../../shared/domain/interfaces/language-tools.interface';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  Language,
  LANGUAGES_OR_AUTO,
  type LanguageOrAuto,
} from '../../../../shared/domain/language.vo';
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

// [2026-11-03 · Regla obligatoria]: corrección manual de la gramática del sustantivo (el artículo se deriva del género en el servidor)
export class NounGrammarPatchDto {
  @IsOptional() @IsBoolean() is_noun?: boolean;
  @IsOptional() @IsIn(['m', 'f', 'n']) gender?: 'm' | 'f' | 'n';
  @IsOptional() @IsIn(['a', 'an', 'the', '']) article?: string; // Solo inglés (en el resto se deriva del género)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) plural?: string;
  @IsOptional() @IsBoolean() countable?: boolean;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) pinyin?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(8) classifier?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  measure_example?: string;
}

export class UpdateVocabularyEntryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NounGrammarPatchDto)
  grammar?: NounGrammarPatchDto;
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
  // [Detectar idioma · 2026-10-27]: «auto» → FastAPI detecta el origen y responde `detected_language` | `@IsIn` (class-validator): lista cerrada
  @IsIn(LANGUAGES_OR_AUTO) source!: LanguageOrAuto;
  @IsEnum(Language) target!: Language;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) text!: string;
  // [2026-11-13 · Caso C]: títulos y expresiones → tres opciones (natural, cercana, literal) en vez de una traducción literal
  @IsOptional()
  @IsIn(['frase', 'titulo', 'expresion'])
  tipo_de_texto?: TextKind;
  @IsOptional() @IsString() @MaxLength(600) context?: string; // Conversación previa (no se traduce)
}

// [DetectLanguageDto · 2026-10-30]: Enter en /traductor → solo detectar el idioma | `@MaxLength(5000)` = DetectRequest de FastAPI (Fail Fast en la frontera)
export class DetectLanguageDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(5000) text!: string;
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
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  translation?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) sentence?: string; // Se guarda como ejemplo
}

export class WordStatusDto {
  @IsIn(WORD_STATUSES) status!: WordStatus;
}
