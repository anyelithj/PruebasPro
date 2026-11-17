import { ApiProperty } from '@nestjs/swagger'; // [Swagger]: documenta el contrato en /api/v1/docs
import { Type } from 'class-transformer'; // `@Type` (class-transformer): convierte el query string a número antes de validar
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'; // [class-validator]: validación declarativa (ValidationPipe global)
import {
  ENGAGEMENT_KINDS,
  type EngagementKind,
} from '../../domain/interfaces/course-engagement.repository.interface';
import {
  COURSE_REACTION_TYPES,
  type CourseReactionType,
} from '../../domain/entities/course-reaction.entity';
// [DTOs Engagement · 2026-11-13 · Caso F]: entrada validada y salida tipada de favoritos y reacciones | [Patrón]: DTO | [Principio]: SRP + tipado seguro
// Antes el cuerpo era un tipo en línea `{ kind }` → el ValidationPipe no lo validaba y cualquier `kind` desconocido se trataba como «favorito»

// [PUT /courses/:id/reaction]: { "type": "like" | "love" }
export class SetReactionDto {
  @ApiProperty({ enum: COURSE_REACTION_TYPES })
  @IsIn(COURSE_REACTION_TYPES) // `@IsIn` (class-validator): 400 si no es like | love
  type!: CourseReactionType;
}

// [Alias obsoleto POST /courses/:id/reaction]: { "kind": "like" | "love" | "favorite" } → se retira en un sprint posterior
export const LEGACY_REACTION_KINDS = [
  ...COURSE_REACTION_TYPES,
  'favorite',
] as const; // `as const` (TS): tupla literal → tipo unión
export type LegacyReactionKind = (typeof LEGACY_REACTION_KINDS)[number];
export class LegacyReactionDto {
  @ApiProperty({ enum: LEGACY_REACTION_KINDS, deprecated: true })
  @IsIn(LEGACY_REACTION_KINDS)
  kind!: LegacyReactionKind;
}

// [GET /me/favorites?page&limit]: paginación en el servidor con topes (evita respuestas enormes)
export class FavoritesQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional() // `@IsOptional` (class-validator): ausente → valor por defecto
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({ required: false, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48) // Tope del tamaño de página
  limit = 12;

  // [2026-11-16]: ⭐ guardados (por defecto) · 👍 me gusta · ❤️ me encanta
  @ApiProperty({ required: false, enum: ENGAGEMENT_KINDS, default: 'favorite' })
  @IsOptional()
  @IsIn(ENGAGEMENT_KINDS)
  kind: EngagementKind = 'favorite';
}

// [Estado de un curso para el usuario + conteos públicos]: lo devuelven los PUT/DELETE y lo incrusta CourseResponseDto | [Principio]: SSOT del contrato
export class CourseEngagementDto {
  @ApiProperty() courseId!: string;
  @ApiProperty({ description: '⭐ Guardado en «Mis favoritos» (privado)' })
  isFavorite!: boolean;
  @ApiProperty({
    enum: COURSE_REACTION_TYPES,
    nullable: true,
    description: '👍 like · ❤️ love · null = sin reacción (excluyentes)',
  })
  reaction!: CourseReactionType | null;
  @ApiProperty({ description: 'Conteo público de 👍' }) likesCount!: number;
  @ApiProperty({ description: 'Conteo público de ❤️' }) lovesCount!: number;
}
