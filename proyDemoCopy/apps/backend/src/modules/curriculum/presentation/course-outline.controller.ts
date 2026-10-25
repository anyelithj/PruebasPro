import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { CompleteLessonCommand } from '../application/commands/complete-lesson.command';
import { FillLessonGapCommand } from '../application/commands/fill-lesson-gap.command';
import { SaveCourseOutlineCommand } from '../application/commands/save-course-outline.command';
import {
  FillLessonGapDto,
  SaveCourseOutlineDto,
} from '../application/dtos/course-outline.dto';
import { GetCourseOutlineQuery } from '../application/queries/get-course-outline.query';
// [Controller CourseOutline]: estructura Curso → Nivel → Módulo → Unidad → Lección (Etapa 3 de la especificación MCER) | [Patrón]: Thin Controller + CQRS dispatch | [Principio]: SRP (controlador propio, separado del de recursos) | [Tecnología]: NestJS + Swagger
// [Seguridad]: JwtAuthGuard global exige sesión; @Roles(Role.TEACHER) en las escrituras

@ApiTags('curriculum')
@ApiBearerAuth()
// `:courseId` con ParseUUIDPipe en cada ruta → 400 antes de tocar la BD si no es UUID
@Controller('curriculum/courses/:courseId')
export class CourseOutlineController {
  constructor(
    private readonly getOutline: GetCourseOutlineQuery,
    private readonly saveOutline: SaveCourseOutlineCommand,
    private readonly fillGap: FillLessonGapCommand,
    private readonly completeLesson: CompleteLessonCommand,
  ) {}

  // [GET …/lessons/:lessonId]: contenido de la lección + anterior/siguiente (línea de tiempo)
  @Get('lessons/:lessonId')
  @ApiOperation({ summary: 'Lección con sus recursos y navegación anterior/siguiente (estudiantes: solo aprobados)' })
  lesson(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.getOutline.lesson(courseId, lessonId, { id: user.sub, role: user.role });
  }

  // [POST …/lessons/:lessonId/complete]: idempotente → devuelve la siguiente lección pendiente
  @Post('lessons/:lessonId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar la lección como completada y obtener la siguiente' })
  complete(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.completeLesson.execute(courseId, lessonId, { id: user.sub, role: user.role });
  }

  @Get('outline')
  @ApiOperation({
    summary:
      'Estructura del curso con recursos por lección y huecos (estudiantes: solo aprobados)',
  })
  outline(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.getOutline.execute(courseId, { id: user.sub, role: user.role });
  }

  // `@Put` (HTTP idempotente): el mismo esquema enviado dos veces deja el mismo resultado
  @Put('outline')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary:
      'Guardar la estructura y reutilizar recursos existentes (TEACHER+)',
  })
  save(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: SaveCourseOutlineDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.saveOutline.execute(courseId, dto, {
      id: user.sub,
      role: user.role,
    });
  }

  @Post('lessons/:lessonId/fill')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generar contenido SOLO si la lección está vacía (existente → caché → LLM) (TEACHER+)',
  })
  fill(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: FillLessonGapDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fillGap.execute(courseId, lessonId, dto, {
      id: user.sub,
      role: user.role,
    });
  }
}
