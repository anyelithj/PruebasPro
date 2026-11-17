import { Inject, Injectable } from '@nestjs/common';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { CourseFilterDto } from '../dtos/course-filter.dto';
import { CourseEngagementUseCase } from './course-engagement.use-case';
import {
  CourseResponseDto,
  PaginatedCoursesResponseDto,
} from '../dtos/course-response.dto';
// [UseCase ListCourses]: catálogo paginado con filtros + estado del usuario | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class ListCoursesUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
    private readonly engagement: CourseEngagementUseCase, // [Caso F]: favorito, reacción y conteos de la página (lote, sin N+1)
  ) {}

  async execute(
    filter: CourseFilterDto,
    userId: string | null,
  ): Promise<PaginatedCoursesResponseDto> {
    const { data, total, page, limit } = await this.repo.findAll({
      group: filter.group,
      category: filter.category,
      eje: filter.eje,
      search: filter.search,
      isProBono:
        filter.isProBono === undefined
          ? undefined
          : filter.isProBono === 'true',
      isPublished: true,
      // [Solo catálogo vigente]: oculta cursos legacy sin borrarlos | [Patrón]: Backward Compatibility
      onlyActiveGroups: true,
      page: filter.page,
      limit: filter.limit,
    });

    // [N+1 mitigado]: cargamos enrollments del usuario en batch si hay sesión | [Principio]: KISS
    // `Promise.all` (ES2015): inscripciones y engagement en paralelo
    const [enrollments, views] = await Promise.all([
      userId ? this.repo.listEnrollmentsByUser(userId) : [],
      this.engagement.snapshot(
        userId,
        data.map((c) => c.id),
      ),
    ]);
    const enrollMap = new Map(enrollments.map((e) => [e.courseId, e]));

    const dtos = data.map((c) =>
      CourseResponseDto.fromDomain(
        c,
        enrollMap.get(c.id) ?? null,
        null,
        views.get(c.id),
      ),
    );
    return { data: dtos, total, page, limit };
  }
}
