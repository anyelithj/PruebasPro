import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { Language } from '../../../../shared/domain/language.vo';
import {
  SONG_STATUSES,
  type SongStatus,
} from '../../domain/entities/song.entity';
import {
  LICENSE_TYPES,
  type LicenseType,
} from '../../domain/value-objects/license.vo';
// [DTOs Music · Sprints 9.2/9.9/9.10]: contratos de entrada de canciones, letras, colecciones y prácticas — validados en la frontera | [Patrón]: DTO + Validation (class-validator) | [Principio]: Fail Fast + DRY (LicenseBody también en Dialogues) | [Paradigma]: Declarativo (decoradores)

export class LicenseBody {
  @IsIn(LICENSE_TYPES) type!: LicenseType;
  @IsString() @MaxLength(300) source!: string;
  @IsString() @MinLength(2) @MaxLength(160) holder!: string;
  @IsOptional() @IsString() @MaxLength(40) variant?: string;
  @IsBoolean() confirmed!: boolean;
}

export class CreateSongBody {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(160) artist?: string;
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
  @ValidateNested() @Type(() => LicenseBody) license!: LicenseBody;
}

export class UpdateSongBody extends PartialType(CreateSongBody) {}

export class SongStatusBody {
  @IsIn(SONG_STATUSES) status!: SongStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class LyricsBody {
  @IsString() @MinLength(1) @MaxLength(12000) lyrics!: string; // Una línea por verso; las líneas vacías separan estrofas
  // [2026-10-19 · modo]: true (por defecto) = IPA y traducción automáticas · false = manual (el docente las escribe)
  @IsOptional() @IsBoolean() auto?: boolean;
}

// [2026-10-24 · Letra desde un enlace]: página pública con la letra (NestJS la descarga como navegador, con protección SSRF)
export class LyricsUrlBody {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2000) url!: string;
}

// [2026-10-24 · Letra con IA]: idioma, nivel y tema de la canción didáctica (el docente revisa el borrador antes de guardarlo)
export class LyricsDraftBody {
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
  @IsString() @MinLength(3) @MaxLength(200) topic!: string;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
}

export class LinePatchBody {
  @IsUUID() id!: string;
  @IsOptional() @IsString() @MaxLength(500) text?: string;
  @IsOptional() @IsString() @MaxLength(600) ipa?: string;
  @IsOptional() @IsString() @MaxLength(600) ipaUs?: string;
  @IsOptional() @IsString() @MaxLength(600) translation?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(3600) startS?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(3600) endS?: number;
  @IsOptional() @IsBoolean() reviewed?: boolean;
}

export class LinesPatchBody {
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => LinePatchBody)
  lines!: LinePatchBody[];
  @IsOptional() @IsIn(['manual', 'auto']) timingSource?: 'manual' | 'auto';
}

export class CollectionBody {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsEnum(Language) language!: Language;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
  @IsOptional() @IsString() @MaxLength(60) theme?: string;
  @IsOptional() @IsString() @MaxLength(16) emoji?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  songIds?: string[];
}

export class UpdateCollectionBody extends PartialType(CollectionBody) {}

export class SongPracticeBody {
  @IsIn(['gap_fill', 'order_lines', 'mark_words'])
  kind!: 'gap_fill' | 'order_lines' | 'mark_words';
}
