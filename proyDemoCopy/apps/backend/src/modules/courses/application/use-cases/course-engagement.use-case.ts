import { Inject, Injectable, NotFoundException } from '@nestjs/common'; // [NestJS]: DI + excepción HTTP 404
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import {
  COURSE_ENGAGEMENT_REPOSITORY,
  NO_COUNTS,
  NO_ENGAGEMENT,
  type ICourseEngagementRepository,
  type EngagementKind,
  type UserEngagement,
} from '../../domain/interfaces/course-engagement.repository.interface';
import type { CourseReactionType } from '../../domain/entities/course-reaction.entity';
import type {
  CourseEngagementDto,
  LegacyReactionKind,
} from '../dtos/course-engagement.dto';
import {
  CourseResponseDto,
  type PaginatedCoursesResponseDto,
} from '../dtos/course-response.dto';
import type { Course } from '../../domain/entities/course.entity';
// [UseCase CourseEngagement · 2026-11-13 · Caso F]: ⭐ Favorito y 👍/❤️ Reacción de un usuario en un curso — sustituye a ToggleFavoriteUseCase y ToggleReactionUseCase
// [Reglas]: favorito independiente de la reacción · like y love excluyentes (elegir una reemplaza la otra) · no exige haber comprado el curso
// [Patrón]: Use Case (Application Service) + Command/Query separados por método | [Principio]: SRP (el «engagement» del curso) + DIP (solo puertos) + DRY (un único `snapshot` para catálogo, detalle y favoritos)

@Injectable()
export class CourseEngagementUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository, // `@Inject(token)` (NestJS): resuelve el puerto por Symbol
    @Inject(COURSE_ENGAGEMENT_REPOSITORY)
    private readonly engagement: ICourseEngagementRepository,
  ) {}

  // ───── Comandos idempotentes (PUT / DELETE) ─────
  async setFavorite(
    userId: string,
    courseId: string,
    on: boolean,
  ): Promise<CourseEngagementDto> {
    await this.assertCourse(courseId); // [Fail Fast]: 404 antes de escribir
    await this.engagement.setFavorite(userId, courseId, on);
    return this.stateOf(userId, courseId);
  }

  async setReaction(
    userId: string,
    courseId: string,
    type: CourseReactionType | null,
  ): Promise<CourseEngagementDto> {
    await this.assertCourse(courseId);
    await this.engagement.setReaction(userId, courseId, type); // null = quitar · like/love = reemplaza la que hubiera
    return this.stateOf(userId, courseId);
  }

  // [toggle · OBSOLETO]: alias de POST …/reaction y POST …/favorite → calcula el siguiente estado y llama a los comandos nuevos (misma regla, sin lógica duplicada)
  async toggle(
    userId: string,
    courseId: string,
    kind: LegacyReactionKind,
  ): Promise<CourseEngagementDto> {
    const current =
      (await this.engagement.engagementOf(userId, [courseId])).get(courseId) ??
      NO_ENGAGEMENT; // `??` (ES2020): sin datos → estado neutro
    if (kind === 'favorite')
      return this.setFavorite(userId, courseId, !current.favorite);
    return this.setReaction(
      userId,
      courseId,
      current.reaction === kind ? null : kind,
    ); // Pulsar la activa la quita; la otra la reemplaza
  }

  // ───── Consultas ─────
  // [snapshot]: estado del usuario + conteos públicos de VARIOS cursos en dos lecturas paralelas (catálogo sin N+1) | userId null = visitante → solo conteos
  async snapshot(
    userId: string | null,
    courseIds: readonly string[],
  ): Promise<ReadonlyMap<string, CourseEngagementDto>> {
    const [mine, counts] = await Promise.all([
      userId
        ? this.engagement.engagementOf(userId, courseIds)
        : new Map<string, UserEngagement>(), // `Promise.all` (ES2015): lecturas en paralelo
      this.engagement.countsOf(courseIds),
    ]);
    return new Map(
      courseIds.map((courseId) => {
        const e = mine.get(courseId) ?? NO_ENGAGEMENT;
        const c = counts.get(courseId) ?? NO_COUNTS;
        return [
          courseId,
          {
            courseId,
            isFavorite: e.favorite,
            reaction: e.reaction,
            likesCount: c.likes,
            lovesCount: c.loves,
          },
        ];
      }),
    );
  }

  // [listFavorites]: «Mis favoritos» paginado en el SERVIDOR → mismos DTO que el catálogo (la card se reutiliza tal cual)
  async listFavorites(
    userId: string,
    page: number,
    limit: number,
    kind: EngagementKind = 'favorite',
  ): Promise<PaginatedCoursesResponseDto> {
    const { ids, total } = await this.engagement.favoriteIds(
      userId,
      page,
      limit,
      kind,
    );
    // ponytail: findById por curso (página ≤ 48 → consultas acotadas y en paralelo); findByIds en el puerto si las páginas crecen
    const [found, enrollments, views] = await Promise.all([
      Promise.all(ids.map((id) => this.courses.findById(id))),
      this.courses.listEnrollmentsByUser(userId), // Progreso y acceso del usuario (misma fuente que el catálogo)
      this.snapshot(userId, ids),
    ]);
    const enrollOf = new Map(enrollments.map((e) => [e.courseId, e]));
    const data = found
      .filter((c): c is Course => c !== null) // [Type guard] (TS): descarta cursos borrados entre la lectura de ids y la de cursos
      .map((c) =>
        CourseResponseDto.fromDomain(
          c,
          enrollOf.get(c.id) ?? null,
          null,
          views.get(c.id),
        ),
      );
    return { data, total, page, limit };
  }

  private async stateOf(
    userId: string,
    courseId: string,
  ): Promise<CourseEngagementDto> {
    return (await this.snapshot(userId, [courseId])).get(courseId)!; // `!` (TS): el snapshot siempre incluye los ids pedidos
  }

  private async assertCourse(courseId: string): Promise<void> {
    if (!(await this.courses.findById(courseId)))
      throw new NotFoundException(`Curso ${courseId} no encontrado`);
  }
}
