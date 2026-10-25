import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { CourseResponseDto } from '../dtos/course-response.dto';
// [UseCase GetCourse]: detalle por id o slug + estado del usuario | [Patrón]: Use Case | [Principio]: SRP

@Injectable()
export class GetCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
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

    const enrollment = userId
      ? await this.repo.getEnrollment(userId, course.id)
      : null;
    return CourseResponseDto.fromDomain(course, enrollment);
  }
}
