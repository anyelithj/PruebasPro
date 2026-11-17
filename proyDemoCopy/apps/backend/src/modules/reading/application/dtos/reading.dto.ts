import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
import {
  MAX_DRAFT_WORDS,
  MIN_DRAFT_WORDS,
} from '../../domain/interfaces/reading-draft.interface';
import { ReadingGenre } from '../../domain/reading-genre';
import {
  READING_KINDS,
  type ReadingKind,
} from '../../domain/sentence-splitter';
// [DTOs Reading · Lectura · 2026-10-25]: contratos de entrada validados en la frontera (borrador IA, crear, editar, frase, progreso, exportar) | [Patrón]: DTO + Validation (class-validator) | [Principio]: Fail Fast + mínimo privilegio (lista blanca de campos: ValidationPipe whitelist) | [Paradigma]: Declarativo (decoradores)

const MAX_PARAGRAPHS = 100;
const MAX_PARAGRAPH = 4000;

// [trim]: `@Transform` (class-transformer) recorta espacios antes de validar longitudes
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DraftReadingBody {
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiProperty({ enum: CefrLevel }) @IsEnum(CefrLevel) level!: CefrLevel;
  @ApiProperty({ enum: ReadingGenre })
  @IsEnum(ReadingGenre)
  genre!: ReadingGenre;
  @ApiProperty({ example: 'Un zorro que aprende a compartir' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  topic!: string;
  // [2026-10-28]: límites compartidos con el adaptador (MIN/MAX_DRAFT_WORDS) | [Principio]: SSOT
  @ApiPropertyOptional({
    minimum: MIN_DRAFT_WORDS,
    maximum: MAX_DRAFT_WORDS,
    default: 180,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_DRAFT_WORDS)
  @Max(MAX_DRAFT_WORDS)
  words?: number;
  @ApiPropertyOptional({
    description: 'Material importado en el que se basa la IA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  sourceText?: string;
  // [2026-11-16]: «dictation» → 3 párrafos de 5–6 frases (lo mínimo del dictado) en vez de 6+ párrafos → la IA local termina a tiempo
  @ApiPropertyOptional({ enum: READING_KINDS, default: 'reading' })
  @IsOptional()
  @IsIn(READING_KINDS)
  kind?: ReadingKind;
}

export class CreateReadingBody {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  // [2026-11-16 · RF-148]: opcional → sin nivel se estima del texto (LevelClassifier, como Diálogos)
  @ApiPropertyOptional({ enum: CefrLevel })
  @IsOptional()
  @IsEnum(CefrLevel)
  level?: CefrLevel;
  @ApiProperty({ enum: ReadingGenre })
  @IsEnum(ReadingGenre)
  genre!: ReadingGenre;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) topic?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) summary?: string;
  @ApiProperty({
    type: [String],
    description: 'Párrafos (en un poema, estrofas con un verso por línea)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARAGRAPHS)
  @IsString({ each: true })
  @MaxLength(MAX_PARAGRAPH, { each: true })
  paragraphs!: string[];
  @IsOptional() @IsIn(['ai', 'manual', 'import']) source?:
    | 'ai'
    | 'manual'
    | 'import';
  @ApiPropertyOptional({ enum: READING_KINDS })
  @IsOptional()
  @IsIn(READING_KINDS)
  kind?: ReadingKind; // [2026-11-16]: lectura (por defecto) o dictado
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) sourceRef?: string;
}

// [UpdateReadingBody]: metadatos, estado (publicar/despublicar como práctica/gramática) y, opcional, el texto completo (re-divide en frases)
export class UpdateReadingBody {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
  @IsOptional() @IsEnum(ReadingGenre) genre?: ReadingGenre;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) topic?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) summary?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) sourceRef?: string;
  @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARAGRAPHS)
  @IsString({ each: true })
  @MaxLength(MAX_PARAGRAPH, { each: true })
  paragraphs?: string[];
}

export class ReadingStatusBody {
  @IsIn(['draft', 'published']) status!: 'draft' | 'published';
}

export class UpdateSentenceBody {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text?: string;
  @IsOptional() @IsString() @MaxLength(1500) translation?: string;
  @IsOptional() @IsString() @MaxLength(1500) ipa?: string;
  @IsOptional() @IsString() @MaxLength(1500) ipaUs?: string;
}

export class ProgressBody {
  @IsInt() @Min(0) @Max(1000) sentence!: number;
  @IsOptional() @IsInt() @Min(0) @Max(500) word?: number;
  @IsOptional() @IsBoolean() finished?: boolean;
}

export class ExportQuery {
  @ApiPropertyOptional({ enum: ['pdf', 'txt', 'docx'], default: 'pdf' })
  @IsOptional()
  @IsIn(['pdf', 'txt', 'docx'])
  format?: 'pdf' | 'txt' | 'docx';
  // [Partes]: «translation,ipa» → qué se incluye además del original | `Transform`: cadena de la URL → lista
  @ApiPropertyOptional({ example: 'translation,ipa' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsIn(['translation', 'ipa'], { each: true })
  include?: Array<'translation' | 'ipa'>;
}

export class ListReadingQuery {
  @IsOptional() @IsEnum(Language) language?: Language;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
  @IsOptional() @IsEnum(ReadingGenre) genre?: ReadingGenre;
  @IsOptional() @IsIn(['true', '1', 'false', '0']) mine?: string;
  @ApiPropertyOptional({ enum: READING_KINDS })
  @IsOptional()
  @IsIn(READING_KINDS)
  kind?: ReadingKind; // [2026-11-16]: sin kind → lecturas (Gestión con mine=true: todas)
}
