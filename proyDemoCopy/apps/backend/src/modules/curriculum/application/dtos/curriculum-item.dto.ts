import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { Language } from '../../../../shared/domain/language.vo';
import { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import { CurriculumItemKind } from '../../domain/value-objects/curriculum-item-kind.vo';
import { Provenance } from '../../domain/value-objects/provenance.vo';
import { ReviewStatus } from '../../domain/value-objects/review-status.vo';
// [DTOs Curriculum]: contratos HTTP de entrada validados antes de llegar al caso de uso | [Patrón]: DTO + Validation Pipeline | [Principio]: SRP + ISP | [Paradigma]: Declarativo (decoradores)
// [Tecnología]: class-validator + class-transformer (validación/transformación) y @nestjs/swagger (documentación OpenAPI)
// [Nota]: aquí se valida la FORMA común; el contenido JSONB por tipo lo valida el dominio (Zod) → cada capa valida lo suyo

// `export class` (TS): las clases (no interfaces) existen en runtime → el ValidationPipe puede leer sus decoradores
export class CreateCurriculumItemDto {
  // `@Matches` (class-validator): slug en minúsculas con guiones → clave natural estable
  @ApiProperty({ example: 'present-perfect' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'key debe ser un slug: minúsculas, números y guiones',
  })
  @MaxLength(120)
  key!: string;

  // `@IsEnum` (class-validator): solo valores del enum; `@ApiProperty({ enum })` los documenta en Swagger
  @ApiProperty({ enum: CurriculumItemKind })
  @IsEnum(CurriculumItemKind)
  kind!: CurriculumItemKind;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language!: Language;

  @ApiProperty({ enum: CefrLevel })
  @IsEnum(CefrLevel)
  level!: CefrLevel;

  @ApiProperty({ enum: LanguageSkill })
  @IsEnum(LanguageSkill)
  skill!: LanguageSkill;

  @ApiProperty({ example: 'Tiempos verbales' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  topic!: string;

  // `@IsObject` (class-validator): exige un objeto JSON; su estructura la valida el esquema del `kind`
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  content!: Record<string, unknown>;

  // `@IsOptional()`: si falta, el caso de uso aplica MANUAL por defecto
  @ApiPropertyOptional({ enum: Provenance, default: Provenance.MANUAL })
  @IsOptional()
  @IsEnum(Provenance)
  provenance?: Provenance;

  @ApiPropertyOptional({
    description: 'Fuente/atribución (obligatoria si provenance = imported)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  source?: string;

  // [Tema del catálogo]: si llega, `topic` y `key` se derivan en backend (nombre y slug del tema)
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  topicId?: string;

  // [Fuente del catálogo]: si falta y la procedencia no es importada → "Contenido propio"
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  // [Trazabilidad IA]: id del borrador generado (curriculum_generations) si el contenido salió de la IA
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  generationId?: string;
}

// [Update]: `PartialType` (@nestjs/swagger) → todos opcionales conservando validadores; `expectedVersion` es obligatorio
export class UpdateCurriculumItemDto extends PartialType(
  CreateCurriculumItemDto,
) {
  // [Concurrencia optimista]: versión que el cliente leyó; si cambió en BD → 409 Conflict
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

// [Cambio de estado editorial]: comando separado del update de contenido (CQRS: intención explícita)
export class ChangeReviewStatusDto {
  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional({ description: 'Motivo (obligatorio al rechazar)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// [Filtros de consulta]: query params → `@Type(() => Number)` (class-transformer) convierte strings a número
export class CurriculumFilterDto {
  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;
  @ApiPropertyOptional({ enum: CefrLevel })
  @IsOptional()
  @IsEnum(CefrLevel)
  level?: CefrLevel;
  @ApiPropertyOptional({ enum: LanguageSkill })
  @IsOptional()
  @IsEnum(LanguageSkill)
  skill?: LanguageSkill;
  @ApiPropertyOptional({ enum: CurriculumItemKind })
  @IsOptional()
  @IsEnum(CurriculumItemKind)
  kind?: CurriculumItemKind;
  @ApiPropertyOptional({ enum: Provenance })
  @IsOptional()
  @IsEnum(Provenance)
  provenance?: Provenance;
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
  // [topic]: tema exacto → recursos de un tema (página de tarjetas)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  topic?: string;
  // [perKind]: agrupa también por tipo (tabla de Gestión: "Las frutas · Vocabulario") | `@Transform` (class-transformer): "true" → true
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  perKind?: boolean;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ───── Catálogo de temas y fuentes ─────

// [Búsqueda de temas]: idioma, nivel y competencia obligatorios → sin cargar todo el catálogo
export class TopicSearchDto {
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiProperty({ enum: CefrLevel }) @IsEnum(CefrLevel) level!: CefrLevel;
  @ApiProperty({ enum: LanguageSkill })
  @IsEnum(LanguageSkill)
  skill!: LanguageSkill;
  @ApiPropertyOptional({ enum: CurriculumItemKind })
  @IsOptional()
  @IsEnum(CurriculumItemKind)
  kind?: CurriculumItemKind;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

// [Nuevo tema]: el slug NO se recibe; se genera en backend
export class CreateTopicDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiProperty({ enum: CefrLevel }) @IsEnum(CefrLevel) level!: CefrLevel;
  @ApiProperty({ enum: LanguageSkill })
  @IsEnum(LanguageSkill)
  skill!: LanguageSkill;
  @ApiPropertyOptional({ enum: CurriculumItemKind })
  @IsOptional()
  @IsEnum(CurriculumItemKind)
  kind?: CurriculumItemKind;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class SourceSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

// [Nueva fuente]: solo el nombre es obligatorio; la atribución se completa de forma determinista si falta
export class CreateSourceDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) type?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  author?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  publisher?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  license?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  attribution?: string;
}

// [Comprobación de clave]: disponibilidad de (idioma, tipo, key) antes de guardar
export class KeyCheckDto {
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiProperty({ enum: CurriculumItemKind })
  @IsEnum(CurriculumItemKind)
  kind!: CurriculumItemKind;
  @ApiProperty() @IsString() @MaxLength(120) key!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  excludeId?: string;
}

// ───── Borradores con IA (no persisten nada) ─────

// [Generar contenido]: el autor elige tipo, destinatario y tema; la IA propone el contenido que luego revisa y guarda
export class GenerateContentDraftDto {
  @ApiProperty({ enum: CurriculumItemKind })
  @IsEnum(CurriculumItemKind)
  kind!: CurriculumItemKind;
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiProperty({ enum: CefrLevel }) @IsEnum(CefrLevel) level!: CefrLevel;
  @ApiProperty({ enum: LanguageSkill })
  @IsEnum(LanguageSkill)
  skill!: LanguageSkill;
  @ApiProperty({ example: 'La familia' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  topic!: string;
  // [force]: el autor pide una versión nueva aunque exista recurso o borrador en caché
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
  // [count]: cuántos elementos distintos generar de una vez (lote) | `@Type(() => Number)` (class-transformer) + `@IsInt/@Min/@Max` (class-validator)
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
  // [exclude]: textos ya creados (p. ej. "apple") → la IA no los repite en lotes siguientes | `@ArrayMaxSize` + `each` (class-validator)
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  exclude?: string[];
}

// [Sugerir temas]: combinación obligatoria; el tipo afina la propuesta
export class SuggestTopicsDto {
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiProperty({ enum: CefrLevel }) @IsEnum(CefrLevel) level!: CefrLevel;
  @ApiProperty({ enum: LanguageSkill })
  @IsEnum(LanguageSkill)
  skill!: LanguageSkill;
  @ApiPropertyOptional({ enum: CurriculumItemKind })
  @IsOptional()
  @IsEnum(CurriculumItemKind)
  kind?: CurriculumItemKind;
}

// ───── Nombre del tema en el idioma del recurso ─────

// [Consulta]: idioma + tema (texto en español del temario)
export class TopicLabelQueryDto {
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiProperty({ example: 'La ropa' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  topic!: string;
}

// [Guardar]: nombre en el idioma + pronunciación + tipo de palabra
export class UpsertTopicLabelDto extends TopicLabelQueryDto {
  @ApiProperty({ example: 'Clothes' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;
  @ApiPropertyOptional({ example: '/kləʊðz/' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ipa?: string;
  @ApiPropertyOptional({ example: 'en-GB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ipaVariant?: string;
  @ApiPropertyOptional({ example: 'sustantivo' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  partOfSpeech?: string;
}

// [Respuesta]: forma pública (también va dentro de cada grupo de /by-topic)
export interface TopicLabelView {
  label: string;
  ipa: { value: string; variant: string } | null;
  partOfSpeech: string | null;
}

// [POST /curriculum/contradictions/scan · Etapa 4]: idioma obligatorio; sin tipo se comparan todos los tipos comparables
export class ScanContradictionsDto {
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiPropertyOptional({ enum: CurriculumItemKind })
  @IsOptional()
  @IsEnum(CurriculumItemKind)
  kind?: CurriculumItemKind;
}

// [GET /curriculum/certifications · Etapa 5]: filtro opcional por idioma
export class CertificationFilterDto {
  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;
}

// [POST /curriculum/certifications/:id/practice · Etapa 5]: nivel, competencia y tipo de los ítems de preparación
export class CertificationPracticeDto {
  @ApiProperty({ enum: CefrLevel }) @IsEnum(CefrLevel) level!: CefrLevel;
  @ApiProperty({ enum: LanguageSkill })
  @IsEnum(LanguageSkill)
  skill!: LanguageSkill;
  @ApiProperty({ enum: CurriculumItemKind })
  @IsEnum(CurriculumItemKind)
  kind!: CurriculumItemKind;
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}

// [ExportCurriculumDto · 2026-10-23]: mismos filtros que el listado + formato del archivo (PDF, Word, Excel o CSV)
export class ExportCurriculumDto extends CurriculumFilterDto {
  @ApiPropertyOptional({ enum: ['pdf', 'docx', 'xlsx', 'csv'] })
  @IsOptional()
  @IsIn(['pdf', 'docx', 'xlsx', 'csv']) // `@IsIn` (class-validator): lista cerrada
  format?: 'pdf' | 'docx' | 'xlsx' | 'csv';
}
