import { Inject, Injectable } from '@nestjs/common';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { CourseFilterDto } from '../dtos/course-filter.dto';
import {
  CourseResponseDto,
  PaginatedCoursesResponseDto,
} from '../dtos/course-response.dto';
// [UseCase ListCourses]: catálogo paginado con filtros + estado del usuario | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class ListCoursesUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
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
    const enrollments = userId
      ? await this.repo.listEnrollmentsByUser(userId)
      : [];
    const enrollMap = new Map(enrollments.map((e) => [e.courseId, e]));

    const dtos = data.map((c) =>
      CourseResponseDto.fromDomain(c, enrollMap.get(c.id) ?? null),
    );
    return { data: dtos, total, page, limit };
  }
}
