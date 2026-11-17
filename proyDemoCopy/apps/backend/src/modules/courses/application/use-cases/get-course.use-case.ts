import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CourseEngagementUseCase } from './course-engagement.use-case';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface'; // [2026-10-28]: perfil público del docente dueño (Port del módulo Users)
import {
  CourseAuthorDto,
  CourseResponseDto,
} from '../dtos/course-response.dto';
// [UseCase GetCourse]: detalle por id o slug + estado del usuario + autoría (bio y redes del docente) | [Patrón]: Use Case | [Principio]: SRP + DIP (depende del Port USER_REPOSITORY, no de TypeORM)

@Injectable()
export class GetCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly engagement: CourseEngagementUseCase, // [Caso F]: favorito, reacción y conteos del detalle
  ) {}

  async execute(
    idOrSlug: string,
    userId: string | null,
  ): Promise<CourseResponseDto> {
    // [Estrategia dual]: probamos uuid primero, luego slug | [Principio]: OCP
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
    const course = looksLikeUuid
      ? await this.repo.findById(idOrSlug)
      : await this.repo.findBySlug(idOrSlug);

    if (!course)
      throw new NotFoundException(`Curso "${idOrSlug}" no encontrado`);

    // `Promise.all` (ES2015): inscripción y autor en paralelo | [Rendimiento]
    const [enrollment, owner, views] = await Promise.all([
      userId ? this.repo.getEnrollment(userId, course.id) : null,
      // [Autoría · 2026-10-28]: solo cursos con dueño · `.catch(() => null)`: un fallo leyendo el perfil no tumba el detalle | [Principio]: Fail-soft
      course.createdBy
        ? this.users.findById(course.createdBy).catch(() => null)
        : null,
      this.engagement.snapshot(userId, [course.id]), // [Caso F]: ⭐ / 👍❤️ del usuario + conteos públicos
    ]);
    // [Least Privilege]: cuenta desactivada → no se expone su perfil
    const author = owner?.isActive ? CourseAuthorDto.fromUser(owner) : null;
    return CourseResponseDto.fromDomain(
      course,
      enrollment,
      author,
      views.get(course.id),
    );
  }
}
