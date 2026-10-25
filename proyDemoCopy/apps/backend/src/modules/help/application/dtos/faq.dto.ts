import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  HELP_LOCALES,
  HELP_ROLES,
  type HelpLocale,
  type HelpRole,
} from '../../domain/entities/faq.entity';
// [DTOs Faq · Sprint 7.10]: contratos de entrada de la FAQ (crear, editar, filtrar) | [Patrón]: DTO + Validation (class-validator) | [Principio]: Fail Fast (el ValidationPipe global rechaza antes del caso de uso) + DRY (`PartialType` reutiliza las reglas de Create)

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value; // `@Transform` (class-transformer): sin espacios sobrantes

export class CreateFaqDto {
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) question!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(4000) answer!: string;
  // [Categoría]: slug corto en minúsculas («cuenta», «pagos»…) → filtro estable en la UI
  @Matches(/^[a-z0-9-]{2,40}$/) category!: string;
  @IsOptional() @IsIn(HELP_ROLES) role?: HelpRole;
  @IsOptional() @IsIn(HELP_LOCALES) locale?: HelpLocale;
  @IsOptional() @Matches(/^[a-z0-9-]{2,80}$/) manualSlug?: string;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class ListFaqsQuery {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Matches(/^[a-z0-9-]{2,40}$/) category?: string;
  @IsOptional() @IsIn(HELP_ROLES) role?: HelpRole;
  @IsOptional() @IsIn(HELP_LOCALES) locale?: HelpLocale;
}
