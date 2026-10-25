import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
import { CourseResponseDto } from '../dtos/course-response.dto';
// [UseCase SetPublished]: activa/desactiva publicación del curso (baja blanda) | [Patrón]: Use Case (Command) | [Principio]: SRP

@Injectable()
export class SetPublishedUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  async execute(id: string, isPublished: boolean): Promise<CourseResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Curso ${id} no encontrado`);
    const updated = await this.repo.setPublished(id, isPublished);
    return CourseResponseDto.fromDomain(updated, null);
  }
}
