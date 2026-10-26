import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'; // [2026-10-23]: DTO del borrador IA
import { Language } from '../../../shared/domain/language.vo';
import { DraftCourseUseCase } from '../application/use-cases/draft-course.use-case';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Public } from '../../../shared/decorators/public.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { CourseFilterDto } from '../application/dtos/course-filter.dto';
import { CreateCourseDto } from '../application/dtos/create-course.dto';
import { UpdateCourseDto } from '../application/dtos/update-course.dto';
import { SetPublishedDto } from '../application/dtos/set-published.dto';
import {
  CourseResponseDto,
  PaginatedCoursesResponseDto,
} from '../application/dtos/course-response.dto';
import { ListCoursesUseCase } from '../application/use-cases/list-courses.use-case';
import { AdminListCoursesUseCase } from '../application/use-cases/admin-list-courses.use-case';
import { GetCourseUseCase } from '../application/use-cases/get-course.use-case';
import { ToggleFavoriteUseCase } from '../application/use-cases/toggle-favorite.use-case';
import { ToggleReactionUseCase } from '../application/use-cases/toggle-reaction.use-case';
import { CreateCourseUseCase } from '../application/use-cases/create-course.use-case';
import { UpdateCourseUseCase } from '../application/use-cases/update-course.use-case';
import { DeleteCourseUseCase } from '../application/use-cases/delete-course.use-case';
import { SetPublishedUseCase } from '../application/use-cases/set-published.use-case';
import { PurchaseCourseUseCase } from '../application/use-cases/purchase-course.use-case';
import type { ReactionKind } from '../domain/interfaces/course.repository.interface';
// [Controller Courses]: REST API del Bounded Context Courses | [Patrón]: Controller (MVC) | [Principio]: SRP

// [DTO DraftCourse · 2026-10-23]: datos mínimos para que la IA proponga la ficha del curso | [Patrón]: DTO
export class DraftCourseDto {
  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language!: Language;

  @ApiProperty({ example: 'A1' })
  @Matches(/^[ABC][12]$/)
  level!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @ApiProperty({
    required: false,
    description: 'Texto importado (PDF/Word/URL)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly listCourses: ListCoursesUseCase,
    private readonly adminListCourses: AdminListCoursesUseCase,
    private readonly getCourse: GetCourseUseCase,
    private readonly toggleFavorite: ToggleFavoriteUseCase,
    private readonly toggleReaction: ToggleReactionUseCase,
    private readonly createCourse: CreateCourseUseCase,
    private readonly updateCourse: UpdateCourseUseCase,
    private readonly deleteCourse: DeleteCourseUseCase,
    private readonly setPublished: SetPublishedUseCase,
    private readonly purchaseCourse: PurchaseCourseUseCase,
    private readonly draftCourse: DraftCourseUseCase,
  ) {}

  // ────────────────────────── PUBLIC ──────────────────────────

  // [GET /courses]: catálogo público — solo publicados | [Patrón]: Public Route
  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Listado paginado del catálogo de cursos (público — solo publicados)',
  })
  async list(
    @Query() filter: CourseFilterDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<PaginatedCoursesResponseDto> {
    return this.listCourses.execute(filter, user?.sub ?? null);
  }

  // [GET /courses/admin]: listado administrativo — incluye borradores | [Patrón]: Admin Route | [Seguridad]: @Roles(ADMIN)
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('admin')
  @ApiOperation({ summary: 'Listado admin (incluye borradores) — solo ADMIN' })
  async listAdmin(
    @Query() filter: CourseFilterDto,
  ): Promise<PaginatedCoursesResponseDto> {
    return this.adminListCourses.execute(filter);
  }

  // [GET /courses/:idOrSlug]: detalle público
  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Detalle de curso por id o slug' })
  async detail(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user?: JwtPayload,
  ): Promise<CourseResponseDto> {
    return this.getCourse.execute(idOrSlug, user?.sub ?? null);
  }

  // ────────────────────────── USER (auth) ──────────────────────────

  // [POST /courses/:courseId/favorite]: alterna favorito — requiere sesión | [Patrón]: Command
  @ApiBearerAuth()
  @Post(':courseId/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Alternar favorito del curso (usuario autenticado)',
  })
  async favorite(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.toggleFavorite.execute(user.sub, courseId);
  }

  // [POST /courses/:courseId/purchase]: compra (simulada) o inscripción gratuita → desbloquea videos/PDF | [Patrón]: Command
  @ApiBearerAuth()
  @Post(':courseId/purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Comprar / inscribirse en un curso (usuario autenticado)',
  })
  async purchase(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.purchaseCourse.execute(user.sub, courseId);
  }

  // [POST /courses/:courseId/reaction]: alterna like/love | [Patrón]: Command + Strategy
  @ApiBearerAuth()
  @Post(':courseId/reaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alternar reacción (like | love | favorite)' })
  async reaction(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() body: { kind: ReactionKind },
  ) {
    return this.toggleReaction.execute(user.sub, courseId, body.kind);
  }

  // ────────────────────────── ADMIN CRUD ──────────────────────────

  // [POST /courses/draft · 2026-10-23]: borrador IA (título + descripción Markdown + etiquetas); no guarda | [Patrón]: Query + RBAC
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Borrador de curso generado por IA (ADMIN)' })
  draft(@Body() dto: DraftCourseDto) {
    return this.draftCourse.execute(dto);
  }

  // [POST /courses/draft/topic · 2026-10-25]: explicación de UN subtema del temario (definición, uso, reglas, ejemplos) · `topic` obligatorio
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('draft/topic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Explicación de un subtema del temario generada por IA (ADMIN)',
  })
  draftTopic(@Body() dto: DraftCourseDto) {
    if (!dto.topic?.trim())
      throw new BadRequestException('Escribe el subtema que quieres explicar.');
    return this.draftCourse.topic({
      language: dto.language,
      level: dto.level,
      topic: dto.topic,
      text: dto.text,
    });
  }

  // [POST /courses]: crear curso — ADMIN | [Patrón]: Command + RBAC
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear curso (ADMIN)' })
  async create(@Body() dto: CreateCourseDto): Promise<CourseResponseDto> {
    return this.createCourse.execute(dto);
  }

  // [PATCH /courses/:id]: editar curso — ADMIN
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar curso (ADMIN)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.updateCourse.execute(id, dto);
  }

  // [PATCH /courses/:id/publish]: activar/desactivar (baja blanda) — ADMIN
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id/publish')
  @ApiOperation({ summary: 'Activar/desactivar curso (ADMIN)' })
  async publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPublishedDto,
  ): Promise<CourseResponseDto> {
    return this.setPublished.execute(id, dto.isPublished);
  }

  // [DELETE /courses/:id]: baja dura — ADMIN
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar curso permanentemente (ADMIN)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.deleteCourse.execute(id);
  }
}
