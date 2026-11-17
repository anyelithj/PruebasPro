import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  QUIZ_REPOSITORY,
  type IQuizRepository,
} from '../domain/interfaces/quiz.repository.interface';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role, hasRolePrivilege } from '../../users/domain/value-objects/role.vo';
import { ExamsService } from '../application/use-cases/exams.service';
import { isExam } from '../domain/exam-rules';
import { CreateQuizUseCase } from '../application/use-cases/create-quiz.use-case';
import { GetQuizUseCase } from '../application/use-cases/get-quiz.use-case';
import { ListQuizzesUseCase } from '../application/use-cases/list-quizzes.use-case';
import { GenerateAIQuestionsUseCase } from '../application/use-cases/generate-ai-questions.use-case';
import { StartSessionUseCase } from '../application/use-cases/start-session.use-case';
import { SubmitAnswerUseCase } from '../application/use-cases/submit-answer.use-case';
import { EndSessionUseCase } from '../application/use-cases/end-session.use-case';
import { ListMyHistoryUseCase } from '../application/use-cases/list-my-history.use-case';
import { CreateQuizDto } from '../application/dtos/create-quiz.dto';
import { GenerateAIQuestionsDto } from '../application/dtos/generate-ai-questions.dto';
import { UpdateQuizDto } from '../application/dtos/update-quiz.dto';
import { SubmitAnswerDto } from '../application/dtos/submit-answer.dto';
import { Category } from '../domain/value-objects/category.vo';
import { Difficulty } from '../domain/value-objects/difficulty.vo';
import { Language } from '../domain/value-objects/language.vo'; // [Filtro por idioma · 2026-10-27]: mismas pestañas de idioma que el catálogo de cursos
// [Controller Quiz]: traduce HTTP a Use Case | [Patron]: Controller (MVC) + Facade | [Principio]: SRP | [Paradigma]: POO

@ApiTags('quiz')
@ApiBearerAuth()
@Controller('quiz')
export class QuizController {
  constructor(
    private readonly createUC: CreateQuizUseCase,
    private readonly getUC: GetQuizUseCase,
    private readonly listUC: ListQuizzesUseCase,
    private readonly generateAIUC: GenerateAIQuestionsUseCase,
    private readonly startUC: StartSessionUseCase,
    private readonly submitUC: SubmitAnswerUseCase,
    private readonly endUC: EndSessionUseCase,
    private readonly historyUC: ListMyHistoryUseCase,
    @Inject(QUIZ_REPOSITORY) private readonly quizRepo: IQuizRepository,
    private readonly exams: ExamsService,
  ) {}

  // [GET /quiz/exams/course/:courseId · 2026-11-06]: estado del examen final del curso para el alumno (lo genera si aún no existe y el curso está al 100 %)
  @Get('exams/course/:courseId')
  @ApiOperation({ summary: 'Estado del examen final de un curso (lo genera la primera vez)' })
  async courseExam(@Param('courseId', ParseUUIDPipe) courseId: string, @CurrentUser() user: JwtPayload) {
    return this.exams.courseStatus(user.sub, courseId);
  }

  // [GET /quiz/exams/catalog · 2026-11-06]: exámenes finales y de nivel con etiqueta y candado para el usuario
  @Get('exams/catalog')
  @ApiOperation({ summary: 'Exámenes finales y de nivel con su estado (bloqueado si el curso no está al 100 %)' })
  async examCatalog(@CurrentUser() user: JwtPayload) {
    return this.exams.catalog(user.sub);
  }

  // [GET /quiz/exams/manage · 2026-11-06]: Gestión → Certificados (cursos con su examen final)
  @Get('exams/manage')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Cursos con su examen final (TEACHER: los suyos · ADMIN: todos)' })
  async examManage(@CurrentUser() user: JwtPayload) {
    return this.exams.manage({ id: user.sub, admin: hasRolePrivilege(user.role, Role.ADMIN) });
  }

  // [GET /quiz/exams/attempts · 2026-11-09 · RF-32]: alumnos × examen con intentos, nota y certificado (ADMIN: todos · docente: sus cursos)
  @Get('exams/attempts')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Intentos de exámenes finales y de nivel por alumno' })
  async examAttempts(@CurrentUser() user: JwtPayload, @Query('search') search?: string) {
    return this.exams.attempts({ id: user.sub, admin: hasRolePrivilege(user.role, Role.ADMIN) }, typeof search === 'string' ? search : '');
  }

  // [POST /quiz/exams/:quizId/attempts/:userId/reset · 2026-11-09 · RF-32]: ADMIN anula los intentos suspendidos (incidencia técnica) con motivo
  @Post('exams/:quizId/attempts/:userId/reset')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Restablecer intentos de un alumno en un examen (solo ADMIN)' })
  async resetExamAttempts(
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('reason') reason: unknown,
    @CurrentUser() user: JwtPayload,
  ) {
    if (typeof reason !== 'string' || reason.trim().length < 5) throw new BadRequestException('Explica el motivo (mín. 5 caracteres)');
    return this.exams.resetAttempts(user.sub, quizId, userId, reason);
  }

  // [POST /quiz/exams/course/:courseId/generate · 2026-11-06]: generar el examen final al crear el curso
  @Post('exams/course/:courseId/generate')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Generar con IA el examen final de un curso (autor o ADMIN)' })
  async generateCourseExam(@Param('courseId', ParseUUIDPipe) courseId: string, @CurrentUser() user: JwtPayload) {
    return this.exams.generateForCourse({ id: user.sub, admin: hasRolePrivilege(user.role, Role.ADMIN) }, courseId);
  }

  // [GET /quiz/exams/level?language=de&level=B1 · 2026-11-06]: examen de nivel sin curso → certificado de nivel
  @Get('exams/level')
  @ApiOperation({ summary: 'Estado del examen de nivel (idioma + MCER; lo genera la primera vez)' })
  async levelExam(@Query('language') language: string, @Query('level') level: string, @CurrentUser() user: JwtPayload) {
    return this.exams.levelStatus(user.sub, String(language ?? ''), String(level ?? '').toUpperCase());
  }

  // [GET /quiz]: listar quizzes con filtros + paginacion. publishedOnly=false (TEACHER+) muestra borradores | [Patrón]: Query
  @Get()
  @ApiOperation({
    summary: 'List quizzes (publishedOnly=false requires TEACHER+)',
  })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: Category,
    @Query('difficulty') difficulty?: Difficulty,
    @Query('publishedOnly') publishedOnly?: string,
    @Query('language') language?: string, // [2026-10-27]: ?language=fr → solo exámenes de ese idioma (ISO 639-1)
    @Query('search') search?: string, // [2026-10-30]: filtros de Gestión → Exámenes
    @Query('status') status?: string,
    @Query('kind') kind?: string, // [2026-11-06]: practice (por defecto) | final | level | all
  ) {
    // [Parse booleano]: querystring siempre string. 'false' explícito → incluye no-publicados | [Principio]: Robustez
    const publishedOnlyParsed =
      publishedOnly === 'false'
        ? false
        : publishedOnly === 'true'
          ? true
          : undefined;
    return this.listUC.execute({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      category,
      difficulty,
      publishedOnly: publishedOnlyParsed,
      search,
      status: status === 'published' || status === 'draft' ? status : undefined, // Lista blanca: cualquier otro valor se ignora
      kind: kind === 'final' || kind === 'level' || kind === 'all' ? kind : undefined,
      // [Guard de enum · 2026-10-27]: `Object.values(enum).includes` (JS) → un código desconocido se ignora (no rompe ni filtra todo) | `as` (TS): estrecha tras validar
      language: Object.values(Language).includes(language as Language)
        ? (language as Language)
        : undefined,
    });
  }

  // [GET /quiz/sessions/me]: historial académico del estudiante (puntaje + feedback por pregunta) | [Patrón]: Query | [Principio]: SRP
  @Get('sessions/me')
  @ApiOperation({
    summary:
      'Historial del estudiante autenticado (sesiones + score + feedback por pregunta)',
  })
  async myHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    return this.historyUC.execute(
      user.sub,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // [GET /quiz/sessions/by-user/:userId]: docente/admin consulta historial de cualquier estudiante para seguimiento académico | [Patrón]: Query | [Principio]: SRP + Least Privilege
  @Get('sessions/by-user/:userId')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'Historial académico de un estudiante específico (TEACHER+)',
  })
  async userHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.historyUC.execute(
      userId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // [GET /quiz/:id]: detalle con preguntas
  @Get(':id')
  @ApiOperation({ summary: 'Get quiz by id (with questions)' })
  async getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: JwtPayload) {
    const quiz = await this.getUC.execute(id, true);
    // [2026-11-06 · Exámenes]: el alumno NO recibe respuestas ni explicaciones de un examen (antes viajaban en el JSON)
    if (isExam(quiz.kind) && !(user && hasRolePrivilege(user.role, Role.TEACHER)))
      quiz.questions = quiz.questions?.map(
        ({ correctAnswer: _a, explanation: _e, feedback: _f, ...q }) => q as typeof q & { correctAnswer: string },
      );
    return quiz;
  }

  // [POST /quiz]: solo TEACHER+ pueden crear
  @Post()
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new quiz (TEACHER+)' })
  async create(@Body() dto: CreateQuizDto, @CurrentUser() user: JwtPayload) {
    return this.createUC.execute(dto, user.sub);
  }

  // [DELETE /quiz/:id]: borra quiz + cascade preguntas | [Patrón]: Command
  @Delete(':id')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete quiz (TEACHER+)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const quiz = await this.quizRepo.findQuizById(id, false);
    if (!quiz) throw new NotFoundException(`Quiz ${id} not found`);
    await this.quizRepo.deleteQuiz(id);
  }

  // [PATCH /quiz/:id]: actualización parcial — top-level fields + questions[] opcional | [Patrón]: Command
  @Patch(':id')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'Update quiz partial — questions[] reemplaza todo (TEACHER+)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    // [DTO validado]: whitelist + forbidNonWhitelisted del ValidationPipe global → sin asignación masiva | [Patrón]: DTO + Validation Pipeline
    @Body() body: UpdateQuizDto,
  ) {
    const existing = await this.quizRepo.findQuizById(id, false);
    if (!existing) throw new NotFoundException(`Quiz ${id} not found`);

    // [Separa questions del resto]: reemplaza preguntas si vienen | [Patrón]: Split Update
    const { questions, ...topLevel } = body;
    // [Fix 2026-10-28 · Sin duplicados]: cambio de título/idioma/dificultad/categoría que choca con otro examen → 409 (el propio no cuenta) | regla en el caso de uso (DRY)
    const t = topLevel as Partial<Pick<typeof existing, 'title' | 'language' | 'difficulty' | 'category'>>;
    if (t.title !== undefined || t.language || t.difficulty || t.category)
      await this.createUC.assertUnique(
        (t.title ?? existing.title).trim(),
        {
          language: t.language ?? existing.language,
          difficulty: t.difficulty ?? existing.difficulty,
          category: t.category ?? existing.category,
        },
        existing.id,
      );
    if (Object.keys(topLevel).length > 0) {
      await this.quizRepo.updateQuiz(id, topLevel);
    }
    if (questions && Array.isArray(questions)) {
      return this.quizRepo.replaceQuestions(id, questions as never);
    }
    return this.quizRepo.findQuizById(id, true);
  }

  // [POST /quiz/ai/generate]: genera preguntas vía LLM local (Qwen/Mistral) con fallback automático | [Patrón]: Facade + Strategy
  @Post('ai/generate')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary:
      'Generate questions via local AI (Aya Expanse por defecto). Fallback opcional con AI_FALLBACK_ENABLED.',
  })
  async generateAI(@Body() dto: GenerateAIQuestionsDto) {
    return this.generateAIUC.execute(dto);
  }

  // ===== Sessions =====
  @Post(':id/session')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new quiz session' })
  async startSession(
    @Param('id', ParseUUIDPipe) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.startUC.execute(user.sub, quizId);
  }

  @Post('session/:sessionId/answer')
  @ApiOperation({ summary: 'Submit an answer to a session question' })
  async submit(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SubmitAnswerDto,
    @CurrentUser() user: JwtPayload,
    // [Header Authorization]: token crudo para reenviar a FastAPI (server-to-server con JWT del usuario) | [Patrón]: Token Propagation
    @Headers('authorization') auth: string,
  ) {
    const accessToken = (auth ?? '').replace(/^Bearer\s+/i, '');
    return this.submitUC.execute(sessionId, user.sub, dto, accessToken);
  }

  @Post('session/:sessionId/end')
  @ApiOperation({ summary: 'Finalize a session (complete or abandon)' })
  async endSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: JwtPayload,
    @Query('abandon') abandon?: string,
  ) {
    return this.endUC.execute(sessionId, user.sub, abandon === 'true');
  }
}
