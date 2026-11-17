import { Injectable } from '@nestjs/common'; // [NestJS]: proveedor inyectable
import { InjectRepository } from '@nestjs/typeorm'; // [NestJS + TypeORM]: inyecta el Repository<T> de cada entidad
import { In, Repository } from 'typeorm'; // `In` (TypeORM): operador SQL IN (…) para consultas por lote
import { CourseFavorite } from '../../domain/entities/course-favorite.entity';
import {
  CourseReaction,
  type CourseReactionType,
} from '../../domain/entities/course-reaction.entity';
import {
  NO_ENGAGEMENT,
  type ICourseEngagementRepository,
  type EngagementKind,
  type ReactionCounts,
  type UserEngagement,
} from '../../domain/interfaces/course-engagement.repository.interface';
// [Adapter TypeORM CourseEngagementRepository · 2026-11-13 · Caso F]: implementación PostgreSQL del puerto | [Patrón]: Adapter (Hexagonal) + Repository
// [Idempotencia]: INSERT … ON CONFLICT (upsert / orIgnore) y DELETE → repetir la orden no cambia nada ni falla | [Principio]: DIP + LSP

@Injectable() // `@Injectable` (NestJS): el contenedor DI lo crea y lo entrega por el token COURSE_ENGAGEMENT_REPOSITORY
export class CourseEngagementRepository implements ICourseEngagementRepository {
  constructor(
    @InjectRepository(CourseFavorite)
    private readonly favorites: Repository<CourseFavorite>, // `private readonly` (TS): propiedad inmutable creada desde el parámetro
    @InjectRepository(CourseReaction)
    private readonly reactions: Repository<CourseReaction>,
  ) {}

  async setFavorite(
    userId: string,
    courseId: string,
    on: boolean,
  ): Promise<void> {
    if (!on) {
      await this.favorites.delete({ userId, courseId }); // DELETE idempotente: si no existía, afecta 0 filas
      return;
    }
    // `orIgnore()` (TypeORM): INSERT … ON CONFLICT DO NOTHING → marcar dos veces no duplica ni lanza error
    await this.favorites
      .createQueryBuilder()
      .insert()
      .values({ userId, courseId })
      .orIgnore()
      .execute();
  }

  async setReaction(
    userId: string,
    courseId: string,
    type: CourseReactionType | null,
  ): Promise<void> {
    if (type === null) {
      await this.reactions.delete({ userId, courseId }); // Quitar la reacción activa (idempotente)
      return;
    }
    // `upsert` (TypeORM): INSERT … ON CONFLICT (user_id, course_id) DO UPDATE SET type → like ↔ love se REEMPLAZAN (nunca ambos)
    await this.reactions.upsert({ userId, courseId, type }, [
      'userId',
      'courseId',
    ]);
  }

  async engagementOf(
    userId: string,
    courseIds: readonly string[],
  ): Promise<ReadonlyMap<string, UserEngagement>> {
    if (!courseIds.length) return new Map(); // Sin cursos → sin consulta
    const where = { userId, courseId: In([...courseIds]) }; // `[...x]` (ES2015 spread): copia mutable que pide TypeORM
    // `Promise.all` (ES2015): las dos lecturas en paralelo → un solo tiempo de espera
    const [favs, reacts] = await Promise.all([
      this.favorites.find({ where, select: { courseId: true } }),
      this.reactions.find({ where, select: { courseId: true, type: true } }),
    ]);
    const favSet = new Set(favs.map((f) => f.courseId)); // `Set` (ES2015): búsqueda O(1)
    const reactOf = new Map(reacts.map((r) => [r.courseId, r.type])); // `Map` (ES2015): courseId → tipo
    // `Map` construido con un array de pares → resultado inmutable para el llamador (ReadonlyMap) | [Paradigma]: Funcional (map sin mutación)
    return new Map(
      courseIds.map((id) => [
        id,
        favSet.has(id) || reactOf.has(id)
          ? { favorite: favSet.has(id), reaction: reactOf.get(id) ?? null }
          : NO_ENGAGEMENT,
      ]),
    );
  }

  async countsOf(
    courseIds: readonly string[],
  ): Promise<ReadonlyMap<string, ReactionCounts>> {
    if (!courseIds.length) return new Map();
    // [SQL agregado]: COUNT(*) FILTER (WHERE …) (PostgreSQL) → me gusta y me encanta en una sola pasada por curso
    const rows = await this.reactions
      .createQueryBuilder('r')
      .select('r.course_id', 'courseId')
      .addSelect(`COUNT(*) FILTER (WHERE r.type = 'like')`, 'likes')
      .addSelect(`COUNT(*) FILTER (WHERE r.type = 'love')`, 'loves')
      .where('r.course_id IN (:...ids)', { ids: [...courseIds] }) // `:...ids` (TypeORM): expande el array a parámetros seguros (sin inyección SQL)
      .groupBy('r.course_id')
      .getRawMany<{ courseId: string; likes: string; loves: string }>(); // COUNT devuelve bigint → texto en el driver pg
    return new Map(
      rows.map((r) => [
        r.courseId,
        { likes: Number(r.likes), loves: Number(r.loves) },
      ]),
    ); // `Number()` (JS): texto → número
  }

  async favoriteIds(
    userId: string,
    page: number,
    limit: number,
    kind: EngagementKind = 'favorite',
  ): Promise<{ ids: string[]; total: number }> {
    // [2026-11-16]: 👍/❤️ también se listan → el usuario ve dónde quedó guardada cada valoración
    if (kind !== 'favorite') {
      const [rows, total] = await this.reactions.findAndCount({
        where: { userId, type: kind },
        order: { updatedAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
        select: { courseId: true },
      });
      return { ids: rows.map((r) => r.courseId), total };
    }
    // `findAndCount` (TypeORM): página + total en una llamada | skip/take = OFFSET/LIMIT
    const [rows, total] = await this.favorites.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' }, // Los guardados más recientes primero
      skip: (page - 1) * limit,
      take: limit,
      select: { courseId: true },
    });
    return { ids: rows.map((r) => r.courseId), total };
  }
}
