import { PartialType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';
// [DTO UpdateCourse]: edición parcial — todos los campos opcionales | [Patrón]: DTO Partial | [Principio]: OCP + SRP

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
