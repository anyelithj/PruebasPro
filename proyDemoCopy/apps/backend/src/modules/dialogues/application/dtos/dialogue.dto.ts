import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { Language } from '../../../../shared/domain/language.vo';
import { LicenseBody } from '../../../music/application/dtos/song.dto';
// [DTOs Dialogues · Sprints 9.3/9.11–9.13]: contratos de entrada de temas, diálogos, turnos y conversaciones con el avatar — validados en la frontera | [Patrón]: DTO + Validation (class-validator) | [Principio]: Fail Fast + DRY (LicenseBody de Music) | [Paradigma]: Declarativo (decoradores)

export class TopicBody {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(16) emoji?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsEnum(Language) language?: Language;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(CefrLevel, { each: true })
  levels?: CefrLevel[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  objectives?: string[];
  @IsOptional() @IsObject() vocabulary?: Record<string, string[]>; // { en: [...], fr: [...] }
  @IsOptional() @IsString() @MaxLength(300) opening?: string;
}
export class UpdateTopicBody extends PartialType(TopicBody) {}

export class ScriptTurnBody {
  @IsIn(['A', 'B']) speaker!: 'A' | 'B';
  @IsString() @MinLength(1) @MaxLength(600) text!: string;
}

// [2026-10-19 · Borrador]: modo URL (texto de la página que descargó Next.js) o modo IA (tema) → turnos para revisar en el formulario
export class DraftDialogueBody {
  @IsIn(['text', 'ai']) mode!: 'text' | 'ai';
  @IsEnum(Language) language!: Language;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
  @IsOptional() @IsString() @MaxLength(160) topic?: string;
  @IsOptional() @IsString() @MaxLength(20000) text?: string;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  speakers?: string[];
  @IsOptional() @IsNumber() @Min(4) @Max(20) turns?: number;
}

export class CreateDialogueBody {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsUUID() topicId?: string;
  @IsEnum(Language) language!: Language;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  speakers?: string[];
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => ScriptTurnBody)
  turns!: ScriptTurnBody[];
  @ValidateNested() @Type(() => LicenseBody) license!: LicenseBody;
}

export class ConfirmLevelBody {
  @IsEnum(CefrLevel) level!: CefrLevel;
}

// [DialogueStatusBody · 2026-10-24]: publicar / despublicar | `@IsIn` (class-validator): solo los dos valores
export class DialogueStatusBody {
  @IsIn(['published', 'draft']) status!: 'published' | 'draft';
}

export class UpdateTurnBody {
  @IsOptional() @IsIn(['A', 'B']) speaker?: 'A' | 'B';
  @IsOptional() @IsString() @MinLength(1) @MaxLength(600) text?: string;
  @IsOptional() @IsString() @MaxLength(800) ipa?: string;
  @IsOptional() @IsString() @MaxLength(800) ipaUs?: string;
  @IsOptional() @IsString() @MaxLength(800) translation?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(3600) startS?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(3600) endS?: number;
}

export class StartSessionBody {
  @IsUUID() topicId!: string;
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
}

export class UserTurnBody {
  @IsString() @MinLength(1) @MaxLength(600) text!: string; // Lo que dijo el usuario (transcrito por /speech/transcribe) o lo que escribió
}
