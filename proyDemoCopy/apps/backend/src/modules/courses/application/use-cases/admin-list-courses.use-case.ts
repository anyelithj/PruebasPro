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
import { Role } from '../../../users/domain/value-objects/role.vo';
import type { CourseActor } from '../policies/course-ownership.policy';
// [UseCase AdminListCourses]: listado admin incluye borradores (no fuerza isPublished) | [Patrón]: Use Case | [Principio]: SRP

@Injectable()
export class AdminListCoursesUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  // [2026-10-27]: `actor?` → el DOCENTE ve solo sus cursos (`createdBy`); el ADMIN (o sin actor) ve todos | [Patrón]: Specification por rol
  async execute(
    filter: CourseFilterDto,
    actor?: CourseActor,
  ): Promise<PaginatedCoursesResponseDto> {
    const { data, total, page, limit } = await this.repo.findAll({
      createdBy: actor && actor.role !== Role.ADMIN ? actor.id : undefined, // `undefined` = sin filtro
      group: filter.group,
      category: filter.category,
      eje: filter.eje,
      search: filter.search,
      isProBono:
        filter.isProBono === undefined
          ? undefined
          : filter.isProBono === 'true',
      // [isPublished · 2026-10-30]: sin filtro → publicados Y borradores (vista de Gestión); ?isPublished=true|false → filtro «Estado» de la tabla
      isPublished:
        filter.isPublished === undefined
          ? undefined
          : filter.isPublished === 'true',
      page: filter.page,
      limit: filter.limit,
    });

    const dtos = data.map((c) => CourseResponseDto.fromDomain(c, null));
    return { data: dtos, total, page, limit };
  }
}
