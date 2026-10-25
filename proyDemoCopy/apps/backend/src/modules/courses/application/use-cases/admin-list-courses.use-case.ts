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
// [UseCase AdminListCourses]: listado admin incluye borradores (no fuerza isPublished) | [Patrón]: Use Case | [Principio]: SRP

@Injectable()
export class AdminListCoursesUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  async execute(filter: CourseFilterDto): Promise<PaginatedCoursesResponseDto> {
    const { data, total, page, limit } = await this.repo.findAll({
      group: filter.group,
      category: filter.category,
      eje: filter.eje,
      search: filter.search,
      isProBono:
        filter.isProBono === undefined
          ? undefined
          : filter.isProBono === 'true',
      // [Sin filtro isPublished]: admin debe ver publicados Y borradores | [SSOT admin view]
      page: filter.page,
      limit: filter.limit,
    });

    const dtos = data.map((c) => CourseResponseDto.fromDomain(c, null));
    return { data: dtos, total, page, limit };
  }
}
