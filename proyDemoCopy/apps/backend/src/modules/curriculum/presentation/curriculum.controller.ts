import {
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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler'; // [2026-10-24]: límite propio para la publicación en lote
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { ChangeReviewStatusCommand } from '../application/commands/change-review-status.command';
import { BulkPublishCommand } from '../application/commands/bulk-publish.command';
import { DeleteCurriculumItemCommand } from '../application/commands/delete-curriculum-item.command';
import { CreateCurriculumItemCommand } from '../application/commands/create-curriculum-item.command';
import { UpdateCurriculumItemCommand } from '../application/commands/update-curriculum-item.command';
import type { CurriculumActor } from '../application/curriculum-actor';
import {
  BulkPublishDto,
  ChangeReviewStatusDto,
  CreateCurriculumItemDto,
  CreateSourceDto,
  CreateTopicDto,
  CurriculumFilterDto,
  GenerateContentDraftDto,
  TopicLabelQueryDto,
  UpsertTopicLabelDto,
  SuggestTopicsDto,
  KeyCheckDto,
  SourceSearchDto,
  TopicSearchDto,
  UpdateCurriculumItemDto,
  ScanContradictionsDto,
  CertificationFilterDto,
  CertificationPracticeDto,
  ExportCurriculumDto,
} from '../application/dtos/curriculum-item.dto';
import { ExportCurriculumQuery } from '../application/queries/export-curriculum.query';
import { CertificationPracticeQuery } from '../application/queries/certification-practice.query';
import { certificationsFor } from '../domain/certifications';
import { ScanContradictionsCommand } from '../application/commands/scan-contradictions.command';
import { GetCurriculumItemQuery } from '../application/queries/get-curriculum-item.query';
import {
  CheckKeyQuery,
  SearchSourcesQuery,
  SearchTopicsQuery,
} from '../application/queries/catalog.queries';
import { CreateTopicCommand } from '../application/commands/create-topic.command';
import { CreateSourceCommand } from '../application/commands/create-source.command';
import {
  ListCurriculumItemsQuery,
  ListTopicGroupsQuery,
} from '../application/queries/list-curriculum-items.query';
import { TopicLabelService } from '../application/topic-labels';
import {
  GenerateContentDraftQuery,
  SuggestTopicsQuery,
} from '../application/queries/ai-draft.queries';
// [Controller Curriculum]: capa de presentación HTTP; traduce requests en comandos/consultas y no contiene reglas de negocio | [Patrón]: MVC (Controller) + Thin Controller + CQRS dispatch | [Principio]: SRP + DIP | [Paradigma]: POO + Decoradores (AOP)
// [Tecnología]: NestJS (routing por decoradores) + Swagger (@nestjs/swagger) para documentación OpenAPI
// [Seguridad]: JwtAuthGuard global exige sesión; @Roles(Role.TEACHER) exige docente o superior (jerarquía) en las escrituras

// `@ApiTags` / `@ApiBearerAuth` (Swagger): agrupan y documentan el endpoint con JWT
@ApiTags('curriculum')
@ApiBearerAuth()
// `@Controller('curriculum')` (NestJS): prefijo de ruta → /api/v1/curriculum
@Controller('curriculum')
export class CurriculumController {
  // [Inyección por constructor]: un handler por caso de uso → cada clase con una sola responsabilidad
  constructor(
    private readonly createItem: CreateCurriculumItemCommand,
    private readonly updateItem: UpdateCurriculumItemCommand,
    private readonly changeStatus: ChangeReviewStatusCommand,
    private readonly deleteItem: DeleteCurriculumItemCommand,
    private readonly listItems: ListCurriculumItemsQuery,
    private readonly getItem: GetCurriculumItemQuery,
    private readonly searchTopics: SearchTopicsQuery,
    private readonly searchSources: SearchSourcesQuery,
    private readonly checkKey: CheckKeyQuery,
    private readonly createTopic: CreateTopicCommand,
    private readonly createSource: CreateSourceCommand,
    private readonly generateDraft: GenerateContentDraftQuery,
    private readonly suggestTopics: SuggestTopicsQuery,
    private readonly topicGroups: ListTopicGroupsQuery,
    private readonly topicLabels: TopicLabelService,
    private readonly scanContradictions: ScanContradictionsCommand,
    private readonly certificationPractice: CertificationPracticeQuery,
    private readonly exportItems: ExportCurriculumQuery,
    private readonly bulkPublish: BulkPublishCommand,
  ) {}

  // ───── Catálogo (rutas estáticas antes de ':id') ─────

  @Get('topics')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'Buscar temas compatibles con idioma, nivel y competencia',
  })
  topics(@Query() dto: TopicSearchDto) {
    return this.searchTopics.execute(dto);
  }

  @Post('topics')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear tema (ADMIN) — slug generado automáticamente',
  })
  newTopic(@Body() dto: CreateTopicDto, @CurrentUser() user: JwtPayload) {
    return this.createTopic.execute(dto, this.actor(user));
  }

  @Get('sources')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Buscar fuentes registradas' })
  sources(@Query() dto: SourceSearchDto) {
    return this.searchSources.execute(dto);
  }

  @Post('sources')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear fuente (ADMIN)' })
  newSource(@Body() dto: CreateSourceDto) {
    return this.createSource.execute(dto);
  }

  @Get('key-check')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'Comprobar si una clave (slug) está libre para idioma + tipo',
  })
  keyCheck(@Query() dto: KeyCheckDto) {
    return this.checkKey.execute(dto);
  }

  // ───── Borradores con IA (rutas estáticas antes de ':id') ─────
  // `@Post` + `@HttpCode(200)`: es una consulta costosa (no crea nada) → POST por el cuerpo, pero responde 200
  @Post('ai/content')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generar con IA un borrador de contenido (TEACHER+) — no se guarda',
  })
  aiContent(
    @Body() dto: GenerateContentDraftDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.generateDraft.execute(dto, user.sub); // `user.sub`: autor del borrador (trazabilidad)
  }

  @Post('ai/topics')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sugerir con IA temas del temario para una combinación (TEACHER+)',
  })
  aiTopics(@Body() dto: SuggestTopicsDto) {
    return this.suggestTopics.execute(dto);
  }

  // [POST /curriculum/contradictions/scan · Etapa 4]: compara fuentes y marca CONTRADICCION_DETECTADA (ruta estática antes de ':id')
  @Post('contradictions/scan')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Comparar recursos entre fuentes y marcar contradicciones (TEACHER+)',
  })
  scan(@Body() dto: ScanContradictionsDto, @CurrentUser() user: JwtPayload) {
    return this.scanContradictions.execute(
      dto.language,
      dto.kind,
      this.actor(user),
    );
  }

  // [GET /curriculum/certifications · Etapa 5]: catálogo estático desde especificaciones públicas (lectura pura, sin caso de uso extra) | ruta estática antes de ':id'
  @Get('certifications')
  @ApiOperation({
    summary:
      'Certificaciones por idioma: niveles MCER, competencias y enlace oficial',
  })
  certifications(@Query() dto: CertificationFilterDto) {
    return certificationsFor(dto.language);
  }

  // [POST /curriculum/certifications/:certificationId/practice]: borrador de ítems ORIGINALES (no se guarda)
  @Post('certifications/:certificationId/practice')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generar ítems originales de preparación para una certificación (TEACHER+) — no se guarda',
  })
  practice(
    @Param('certificationId') certificationId: string,
    @Body() dto: CertificationPracticeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.certificationPractice.execute(certificationId, dto, user.sub);
  }

  // [GET /curriculum/topic-label]: nombre del tema en el idioma (null si no existe)
  @Get('topic-label')
  @ApiOperation({
    summary:
      'Nombre del tema en el idioma del recurso, con pronunciación y tipo de palabra',
  })
  topicLabel(@Query() dto: TopicLabelQueryDto) {
    return this.topicLabels.get(dto.language, dto.topic);
  }

  // [PUT /curriculum/topic-label]: crea o actualiza (TEACHER+)
  @Put('topic-label')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'Guardar el nombre del tema en el idioma (TEACHER+)',
  })
  saveTopicLabel(
    @Body() dto: UpsertTopicLabelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.topicLabels.upsert(dto, user.sub);
  }

  // [POST /curriculum/ai/topic-label]: sugerencia con IA (no se guarda)
  @Post('ai/topic-label')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sugerir con IA el nombre del tema en el idioma (TEACHER+)',
  })
  suggestTopicLabel(@Body() dto: TopicLabelQueryDto) {
    return this.topicLabels.suggest(dto.language, dto.topic);
  }

  // [GET /curriculum/export · 2026-10-23]: descarga el contenido filtrado (p. ej. un tema) en PDF, Word, Excel o CSV — ruta estática antes de ':id'
  // `@Res()` (NestJS): respuesta manual con `attachment` → el navegador descarga el archivo
  @Get('export')
  @ApiOperation({
    summary: 'Descargar los recursos filtrados en PDF, Word, Excel o CSV',
  })
  async export(
    @Query() dto: ExportCurriculumDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { format = 'pdf', ...filter } = dto;
    const file = await this.exportItems.execute(
      filter,
      this.actor(user),
      format,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(file.buffer);
  }

  // [POST /curriculum/status/bulk · 2026-10-24]: publica/despublica un tema completo en UNA petición (ruta estática antes de ':id')
  // `@Throttle` (@nestjs/throttler v6): contador PROPIO de esta ruta (10/min) → no consume el cupo global por cada recurso del lote | [Patrón]: Per-Route Policy
  @Post('status/bulk')
  @Roles(Role.TEACHER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publicar o despublicar varios recursos (publicar: solo ADMIN) — idempotente: lo ya publicado se omite',
  })
  statusBulk(@Body() dto: BulkPublishDto, @CurrentUser() user: JwtPayload) {
    return this.bulkPublish.execute(dto.ids, dto.publish, this.actor(user));
  }

  // [GET /curriculum/by-topic]: recursos agrupados por tema (estudiantes: solo aprobados) — ruta estática antes de ':id'
  @Get('by-topic')
  @ApiOperation({ summary: 'Recursos agrupados por tema, idioma y nivel' })
  byTopic(
    @Query() filter: CurriculumFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.topicGroups.execute(filter, this.actor(user));
  }

  // `@Get()` (NestJS): GET /curriculum — `@Query()` valida los filtros con CurriculumFilterDto (ValidationPipe global)
  @Get()
  @ApiOperation({
    summary: 'Listar recursos curriculares (estudiantes: solo aprobados)',
  })
  list(@Query() filter: CurriculumFilterDto, @CurrentUser() user: JwtPayload) {
    return this.listItems.execute(filter, this.actor(user)); // Devuelve Promise; Nest la resuelve (async)
  }

  // `ParseUUIDPipe` (NestJS): rechaza con 400 ids que no son UUID antes de tocar la BD
  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de un recurso (+ historial para docentes/admin)',
  })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.getItem.execute(id, this.actor(user));
  }

  // `@Post()` + `@HttpCode(201)`: alta de recurso (comando)
  @Post()
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear recurso curricular (TEACHER+) — nace en borrador',
  })
  create(
    @Body() dto: CreateCurriculumItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.createItem.execute(dto, this.actor(user));
  }

  // `@Patch(':id')`: edición parcial versionada (requiere expectedVersion)
  @Patch(':id')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary:
      'Editar recurso (TEACHER+) — concurrencia optimista con expectedVersion',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurriculumItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.updateItem.execute(id, dto, this.actor(user));
  }

  // [Comando explícito de estado]: ruta propia en vez de un PATCH genérico → intención clara y auditable
  @Post(':id/status')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar estado editorial (aprobar/rechazar: solo ADMIN)',
  })
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeReviewStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.changeStatus.execute(id, dto, this.actor(user));
  }

  // `@Delete(':id')`: baja definitiva — solo ADMIN (el docente puede archivar con /status)
  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar recurso y su historial (ADMIN)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteItem.execute(id);
  }

  // `private` (TS): mapea el payload JWT al actor de la aplicación → la capa de aplicación no conoce JWT | [Patrón]: Adapter
  private actor(user: JwtPayload): CurriculumActor {
    return { id: user.sub, role: user.role };
  }
}
