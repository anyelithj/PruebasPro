import type { CourseReactionType } from '../entities/course-reaction.entity'; // `import type` (TS): solo tipos, se borra al compilar
// [Port ICourseEngagementRepository · 2026-11-13 · Caso F]: favoritos y reacciones FUERA de la inscripción | [Patrón]: Repository + Port (Hexagonal)
// [Principio]: ISP (puerto pequeño y propio, no se engorda ICourseRepository) + DIP (los casos de uso dependen de esta interfaz, no de TypeORM)

export const COURSE_ENGAGEMENT_REPOSITORY = Symbol(
  'COURSE_ENGAGEMENT_REPOSITORY',
); // `Symbol` (ES2015): token único de inyección (NestJS DI)

// [Estado del usuario en un curso]: ⭐ y 👍/❤️ son independientes → un curso puede ser favorito Y tener ❤️
export interface UserEngagement {
  readonly favorite: boolean; // `readonly` (TS): valor inmutable una vez leído
  readonly reaction: CourseReactionType | null; // null = sin reacción
}

// [Conteos públicos]: solo me gusta y me encanta (el conteo de favoritos es privado y no se expone)
export interface ReactionCounts {
  readonly likes: number;
  readonly loves: number;
}

export interface ICourseEngagementRepository {
  // [Comandos idempotentes]: repetir la misma orden deja el mismo estado (PUT/DELETE de HTTP)
  setFavorite(userId: string, courseId: string, on: boolean): Promise<void>;
  setReaction(
    userId: string,
    courseId: string,
    type: CourseReactionType | null,
  ): Promise<void>; // null = quitar la reacción
  // [Consultas por lote]: un viaje a la BD para toda la página del catálogo (evita N+1) | `ReadonlyMap` (TS): el llamador no la muta
  engagementOf(
    userId: string,
    courseIds: readonly string[],
  ): Promise<ReadonlyMap<string, UserEngagement>>;
  countsOf(
    courseIds: readonly string[],
  ): Promise<ReadonlyMap<string, ReactionCounts>>;
  // [Mis favoritos]: ids paginados en el servidor, del más reciente al más antiguo · kind = ⭐ guardados o 👍/❤️ valorados [2026-11-16]
  favoriteIds(
    userId: string,
    page: number,
    limit: number,
    kind?: EngagementKind,
  ): Promise<{ ids: string[]; total: number }>;
}

// [Valores neutros]: curso sin datos del usuario o sin reacciones | `Object.freeze` (JS): constantes inmutables compartidas | [Patrón]: Null Object
export const NO_ENGAGEMENT: UserEngagement = Object.freeze({
  favorite: false,
  reaction: null,
});
export const NO_COUNTS: ReactionCounts = Object.freeze({ likes: 0, loves: 0 });

// [EngagementKind · 2026-11-16]: qué lista de «Mis favoritos» se pide (⭐ por defecto)
export const ENGAGEMENT_KINDS = ['favorite', 'like', 'love'] as const;
export type EngagementKind = (typeof ENGAGEMENT_KINDS)[number];
