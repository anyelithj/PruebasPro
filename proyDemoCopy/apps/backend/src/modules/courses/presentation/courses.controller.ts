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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
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
import { CourseEngagementUseCase } from '../application/use-cases/course-engagement.use-case';
import {
  CourseEngagementDto,
  LegacyReactionDto,
  SetReactionDto,
} from '../application/dtos/course-engagement.dto';
import { CreateCourseUseCase } from '../application/use-cases/create-course.use-case';
import { UpdateCourseUseCase } from '../application/use-cases/update-course.use-case';
import { DeleteCourseUseCase } from '../application/use-cases/delete-course.use-case';
import { SetPublishedUseCase } from '../application/use-cases/set-published.use-case';
import { PurchaseCourseUseCase } from '../application/use-cases/purchase-course.use-case';
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
    private readonly engagement: CourseEngagementUseCase, // [Caso F]: ⭐ favorito y 👍/❤️ reacción
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

  // [GET /courses/admin]: listado de gestión — incluye borradores | [Patrón]: Admin Route | [Seguridad]: @Roles(TEACHER) → docente y admin (jerarquía en RolesGuard)
  // [2026-10-27]: el DOCENTE recibe solo los cursos que creó; el ADMIN, todos
  @ApiBearerAuth()
  @Roles(Role.TEACHER)
  @Get('admin')
  @ApiOperation({
    summary:
      'Listado de gestión (incluye borradores) — ADMIN: todos · TEACHER: los suyos',
  })
  async listAdmin(
    @Query() filter: CourseFilterDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedCoursesResponseDto> {
    return this.adminListCourses.execute(filter, {
      id: user.sub,
      role: user.role,
    });
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

  // ───── [Caso F · 2026-11-13] ⭐ Favorito y 👍/❤️ Reacción — requieren sesión (JwtAuthGuard global); no exigen haber comprado el curso ─────
  // [Idempotencia HTTP]: PUT marca y DELETE quita → repetir la petición deja el mismo estado | [Patrón]: Command | respuesta = estado + conteos públicos

  @ApiBearerAuth()
  @Put(':courseId/favorite') // `@Put` (NestJS): guardar en «Mis favoritos»
  @ApiOperation({
    summary: '⭐ Guardar el curso en «Mis favoritos» (idempotente)',
  })
  @ApiOkResponse({ type: CourseEngagementDto })
  addFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ): Promise<CourseEngagementDto> {
    return this.engagement.setFavorite(user.sub, courseId, true);
  }

  @ApiBearerAuth()
  @Delete(':courseId/favorite') // `@Delete` (NestJS): quitar de «Mis favoritos»
  @ApiOperation({
    summary: '⭐ Quitar el curso de «Mis favoritos» (idempotente)',
  })
  @ApiOkResponse({ type: CourseEngagementDto })
  removeFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ): Promise<CourseEngagementDto> {
    return this.engagement.setFavorite(user.sub, courseId, false);
  }

  @ApiBearerAuth()
  @Put(':courseId/reaction')
  @ApiOperation({
    summary:
      '👍/❤️ Reaccionar al curso: { type: like | love } (reemplaza la reacción anterior)',
  })
  @ApiOkResponse({ type: CourseEngagementDto })
  setReaction(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: SetReactionDto, // [ValidationPipe]: 400 si `type` no es like | love
  ): Promise<CourseEngagementDto> {
    return this.engagement.setReaction(user.sub, courseId, dto.type);
  }

  @ApiBearerAuth()
  @Delete(':courseId/reaction')
  @ApiOperation({ summary: '👍/❤️ Quitar la reacción del curso (idempotente)' })
  @ApiOkResponse({ type: CourseEngagementDto })
  clearReaction(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ): Promise<CourseEngagementDto> {
    return this.engagement.setReaction(user.sub, courseId, null);
  }

  // [OBSOLETO]: alias de compatibilidad → mismo caso de uso; se retira en un sprint posterior | `deprecated` (OpenAPI): aparece tachado en Swagger
  @ApiBearerAuth()
  @Post(':courseId/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OBSOLETO · alterna favorito — usa PUT/DELETE …/favorite',
    deprecated: true,
  })
  legacyFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ): Promise<CourseEngagementDto> {
    return this.engagement.toggle(user.sub, courseId, 'favorite');
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

  // [OBSOLETO]: POST …/reaction { kind } → mismo caso de uso (like/love excluyentes; «favorite» alterna ⭐)
  @ApiBearerAuth()
  @Post(':courseId/reaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'OBSOLETO · alterna reacción — usa PUT/DELETE …/reaction y …/favorite',
    deprecated: true,
  })
  legacyReaction(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: LegacyReactionDto, // Antes un tipo en línea sin validar → ahora 400 ante un `kind` desconocido
  ): Promise<CourseEngagementDto> {
    return this.engagement.toggle(user.sub, courseId, dto.kind);
  }

  // ────────────────────────── ADMIN CRUD ──────────────────────────

  // [POST /courses/draft · 2026-10-23]: borrador IA (título + descripción Markdown + etiquetas); no guarda | [Patrón]: Query + RBAC
  // [2026-10-27]: TEACHER+ (antes solo ADMIN) → el docente también crea cursos
  @ApiBearerAuth()
  @Roles(Role.TEACHER)
  @Post('draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Borrador de curso generado por IA (TEACHER+)' })
  draft(@Body() dto: DraftCourseDto) {
    return this.draftCourse.execute(dto);
  }

  // [POST /courses/draft/topic · 2026-10-25]: explicación de UN subtema del temario (definición, uso, reglas, ejemplos) · `topic` obligatorio
  @ApiBearerAuth()
  @Roles(Role.TEACHER)
  @Post('draft/topic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Explicación de un subtema del temario generada por IA (TEACHER+)',
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

  // [POST /courses]: crear curso — TEACHER+ | [Patrón]: Command + RBAC | [2026-10-27]: quien lo crea queda como dueño (`createdBy`)
  @ApiBearerAuth()
  @Roles(Role.TEACHER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear curso (TEACHER+; queda como dueño)' })
  async create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    return this.createCourse.execute(dto, { id: user.sub, role: user.role });
  }

  // [PATCH /courses/:id]: editar curso — ADMIN o el docente dueño (policy de propiedad en el caso de uso → 403)
  @ApiBearerAuth()
  @Roles(Role.TEACHER)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar curso (ADMIN o docente dueño)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    return this.updateCourse.execute(id, dto, {
      id: user.sub,
      role: user.role,
    });
  }

  // [PATCH /courses/:id/publish]: activar/desactivar (baja blanda) — ADMIN o el docente dueño
  @ApiBearerAuth()
  @Roles(Role.TEACHER)
  @Patch(':id/publish')
  @ApiOperation({ summary: 'Activar/desactivar curso (ADMIN o docente dueño)' })
  async publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPublishedDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    return this.setPublished.execute(id, dto.isPublished, {
      id: user.sub,
      role: user.role,
    });
  }

  // [DELETE /courses/:id]: baja dura — ADMIN o el docente dueño
  @ApiBearerAuth()
  @Roles(Role.TEACHER)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar curso permanentemente (ADMIN o docente dueño)',
  })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deleteCourse.execute(id, { id: user.sub, role: user.role });
  }
}
