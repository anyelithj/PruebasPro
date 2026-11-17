import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { finalExamUnlocked } from '../../domain/final-exam-gate';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CEFR_LEVEL_LABEL_ES, isCefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { LANGUAGE_LABEL, isLanguage, type Language } from '../../../../shared/domain/language.vo';
import { COURSE_GROUP_LANGUAGE, type CourseGroup } from '../../../courses/domain/value-objects/course-category.vo';
import { COURSE_COMPLETED_EVENT, type CourseCompletedEvent } from '../../../courses/domain/events/course-completed.event';
import { QuestionType } from '../../domain/entities/question.entity';
import type { Quiz } from '../../domain/entities/quiz.entity';
import { SessionStatus } from '../../domain/entities/quiz-session.entity';
import { QUIZ_REPOSITORY, type IQuizRepository } from '../../domain/interfaces/quiz.repository.interface';
import { Category } from '../../domain/value-objects/category.vo';
import { Difficulty } from '../../domain/value-objects/difficulty.vo';
import {
  BANK_SIZE,
  PASS_SCORE,
  QUESTIONS_PER_ATTEMPT,
  attemptGate,
  examMinutes,
  expired,
} from '../../domain/exam-rules';
import { GenerateAIQuestionsUseCase } from './generate-ai-questions.use-case';
// [ExamsService · 2026-11-06]: examen final de cada curso y examen de nivel por idioma — se GENERAN solos con la IA la primera vez que hacen falta (curso al 100 % o alguien abre el nivel) y se reutilizan
// estado para la UI: locked (curso sin terminar) · generating · error · ready · wait (espera entre intentos) · passed | [Patrón]: Facade + Lazy Init + Observer (course.completed)
// ponytail: candado de generación en memoria (una instancia de NestJS); con varias réplicas, mover a la cola Bull

export type ExamState = 'locked' | 'generating' | 'error' | 'ready' | 'wait' | 'passed';
export interface ExamStatus {
  state: ExamState;
  quizId: string | null;
  title: string;
  cefrLevel: string | null;
  passScore: number;
  timeLimitMinutes: number;
  questions: number; // Por intento
  attemptsUsed: number;
  attemptsLeft: number;
  retryAt: string | null;
  bestPercent: number | null;
  inProgress: boolean; // Hay un intento abierto con tiempo → «Continuar»
  progress?: number; // Solo examen final: % del curso
  message?: string;
}

export interface ExamCatalogItem {
  quizId: string | null; // null = examen final aún sin generar (se genera al llegar al 100 %)
  kind: 'final' | 'level';
  title: string;
  cefrLevel: string | null;
  language: string;
  courseId: string | null;
  courseTitle: string | null;
  courseSlug: string | null;
  questions: number;
  timeLimitMinutes: number;
  passScore: number;
  progress: number | null;
  enrolled: boolean;
  locked: boolean; // Examen final con el curso sin terminar (o sin inscribirse)
  passed: boolean;
}
export interface ExamManageRow {
  courseId: string;
  courseTitle: string;
  cefrLevel: string | null;
  language: string | null;
  published: boolean;
  quizId: string | null;
  questions: number;
  passed: number; // Alumnos que lo aprobaron
  state: 'ready' | 'generating' | 'error' | 'missing';
  message: string | null;
}

export interface ExamAttemptRow {
  userId: string;
  studentName: string;
  studentEmail: string | null; // Solo ADMIN
  quizId: string;
  kind: 'final' | 'level';
  examTitle: string;
  courseId: string | null;
  courseTitle: string | null;
  progress: number | null;
  attemptsUsed: number;
  voided: number;
  bestPercent: number | null;
  passed: boolean;
  inProgress: boolean;
  lastAttemptAt: string | null;
  retryAt: string | null;
  certificateCode: string | null;
  closureApprovedAt: string | null; // [2026-11-09 · RF-32]: cierre académico validado por el docente
  finalGrade: number | null; // Nota corregida por el docente (null = la del examen)
  gradeNote: string | null;
}

const DIFFICULTY_BY_LEVEL: Record<string, Difficulty> = {
  A1: Difficulty.EASY,
  A2: Difficulty.EASY,
  B1: Difficulty.MEDIUM,
  B2: Difficulty.MEDIUM,
  C1: Difficulty.HARD,
  C2: Difficulty.HARD,
};
const RETRY_AFTER_ERROR_MS = 2 * 60_000;

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);
  private readonly running = new Map<string, Promise<Quiz | null>>();
  private readonly failed = new Map<string, { at: number; message: string }>();

  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
    private readonly generator: GenerateAIQuestionsUseCase,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  // ───── Examen final de curso ─────
  async courseStatus(userId: string, courseId: string): Promise<ExamStatus> {
    const [course] = await this.db.query(
      `SELECT c.title, c.category::text AS level, c.category_group::text AS "group", e.progress, e.purchased_at AS "purchasedAt"
       FROM courses c LEFT JOIN course_enrollments e ON e.course_id = c.id AND e.user_id = $2 WHERE c.id = $1`,
      [courseId, userId],
    );
    if (!course) throw new BadRequestException('Curso no encontrado');
    const level = isCefrLevel(course.level) ? course.level : null;
    const base = { title: `Examen final · ${course.title}`, cefrLevel: level, progress: course.progress ?? 0 };
    if (!(await finalExamUnlocked(this.db, userId, courseId)))
      return this.empty('locked', base, 'Completa el 100 % del curso para desbloquear el examen final.');
    const quiz = (await this.repo.findExam({ kind: 'final', courseId })) ?? ((await this.linkOrphanFinals(courseId)) ? await this.repo.findExam({ kind: 'final', courseId }) : null);
    if (quiz) return { ...(await this.attemptsOf(userId, quiz)), progress: base.progress };
    return { ...this.generate(`final:${courseId}`, () => this.createFinal(courseId), base), progress: base.progress };
  }

  // ───── Examen de nivel (idioma + MCER, sin curso) ─────
  async levelStatus(userId: string, language: string, level: string): Promise<ExamStatus> {
    if (!isLanguage(language) || !isCefrLevel(level)) throw new BadRequestException('Idioma o nivel no válido');
    const quiz = await this.repo.findExam({ kind: 'level', language, cefrLevel: level });
    if (quiz) return this.attemptsOf(userId, quiz);
    return this.generate(`level:${language}:${level}`, () => this.createLevel(userId, language, level), {
      title: levelTitle(language, level),
      cefrLevel: level,
    });
  }

  // [onCourseCompleted]: el primer alumno que termina el curso dispara la generación → el examen ya está listo cuando lo abre
  @OnEvent(COURSE_COMPLETED_EVENT, { async: true })
  async onCourseCompleted(e: CourseCompletedEvent): Promise<void> {
    if ((await this.repo.findExam({ kind: 'final', courseId: e.courseId })) || (await this.linkOrphanFinals(e.courseId))) return;
    this.generate(`final:${e.courseId}`, () => this.createFinal(e.courseId), { title: '', cefrLevel: null });
  }

  // [linkOrphanFinals · Fix 2026-11-11]: «Examen final · <curso>» YA guardado pero sin vínculo con su curso (creado como práctica, o su curso se recreó con otro id)
  // → el sistema creía que faltaba y volvía a pedirlo a la IA («Preparando tu examen…» / error de Ollama) aunque el examen existía en la BD
  // Se vincula el más reciente con ese título a cada curso que no tiene examen final | devuelve cuántos vinculó | `courseId` = solo ese curso
  private async linkOrphanFinals(courseId?: string): Promise<number> {
    const [, affected] = (await this.db.query(
      `UPDATE quizzes q
          SET kind = 'final', course_id = c.id,
              cefr_level = COALESCE(q.cefr_level, CASE WHEN c.category::text IN ('A1','A2','B1','B2','C1','C2') THEN c.category::text END)
         FROM courses c
        WHERE ($1::uuid IS NULL OR c.id = $1::uuid)
          AND NOT EXISTS (SELECT 1 FROM quizzes f WHERE f.course_id = c.id AND f.kind = 'final')
          AND q.id = (SELECT o.id FROM quizzes o
                       WHERE o.title = 'Examen final · ' || c.title
                         AND (o.course_id IS NULL OR NOT EXISTS (SELECT 1 FROM courses x WHERE x.id = o.course_id))
                       ORDER BY o.created_at DESC LIMIT 1)`,
      [courseId ?? null],
    )) as [unknown, number];
    if (affected) this.logger.log(`Exámenes finales vinculados a su curso: ${affected}`);
    return affected ?? 0;
  }

  // [generate]: lanza la generación UNA vez por clave (las demás peticiones ven «generating») · error → reintento pasados 2 min
  private generate(key: string, make: () => Promise<Quiz | null>, base: { title: string; cefrLevel: string | null }): ExamStatus {
    const fail = this.failed.get(key);
    if (fail && Date.now() - fail.at < RETRY_AFTER_ERROR_MS) return this.empty('error', base, fail.message);
    if (!this.running.has(key)) {
      this.failed.delete(key);
      const job = make()
        .catch((err: unknown) => {
          const message = `No se pudo generar el examen: ${err instanceof Error ? err.message : String(err)}`;
          this.failed.set(key, { at: Date.now(), message });
          this.logger.warn(`${key}: ${message}`);
          return null;
        })
        .finally(() => this.running.delete(key));
      this.running.set(key, job);
    }
    return this.empty('generating', base, 'Preparando tu examen con la IA… tarda unos minutos la primera vez.');
  }

  private async createFinal(courseId: string): Promise<Quiz | null> {
    const [c] = await this.db.query(
      `SELECT title, content, description, category::text AS level, category_group::text AS "group", created_by AS "createdBy" FROM courses WHERE id = $1`,
      [courseId],
    );
    if (!c) return null;
    const language = COURSE_GROUP_LANGUAGE[c.group as CourseGroup];
    if (!language) throw new Error('el curso no tiene idioma');
    const level = isCefrLevel(c.level) ? c.level : null;
    const source = syllabusSource(String(c.content ?? ''), String(c.description ?? ''));
    return this.build({
      title: `Examen final · ${c.title}`,
      topic: `${c.title}: preguntas repartidas entre todos los subtemas del temario`,
      sourceText: source || undefined,
      language,
      level,
      authorId: c.createdBy ?? (await this.anyAdmin()),
      exam: { kind: 'final', courseId },
    });
  }

  private async createLevel(userId: string, language: Language, level: string): Promise<Quiz | null> {
    return this.build({
      title: levelTitle(language, level),
      topic: `${LANGUAGE_LABEL[language]} nivel ${level} (${CEFR_LEVEL_LABEL_ES[level as keyof typeof CEFR_LEVEL_LABEL_ES]}): gramática, vocabulario y comprensión lectora propios de ese nivel MCER`,
      language,
      level,
      authorId: (await this.anyAdmin()) ?? userId,
      exam: { kind: 'level', courseId: null },
    });
  }

  private async build(o: {
    title: string;
    topic: string;
    sourceText?: string;
    language: Language;
    level: string | null;
    authorId: string | null;
    exam: { kind: 'final' | 'level'; courseId: string | null };
  }): Promise<Quiz> {
    if (!o.authorId) throw new Error('no hay autor para el examen');
    const difficulty = DIFFICULTY_BY_LEVEL[o.level ?? ''] ?? Difficulty.MEDIUM;
    // Solo opción múltiple: se corrige al instante y sin IA durante el examen
    const { questions } = await this.generator.execute({
      topic: o.topic.slice(0, 200),
      amount: BANK_SIZE,
      language: o.language,
      difficulty,
      category: Category.GENERAL,
      type: QuestionType.MULTIPLE_CHOICE,
      sourceText: o.sourceText,
    });
    const usable = questions.filter((q) => q.options?.length >= 2 && q.options.includes(q.correctAnswer));
    if (usable.length < 5) throw new Error('la IA devolvió muy pocas preguntas válidas');
    this.logger.log(`Examen generado: ${o.title} (${usable.length} preguntas)`);
    return this.repo.createQuiz({
      title: o.title,
      description: `Examen generado automáticamente. Aprueba con ${PASS_SCORE} % o más.`,
      category: Category.GENERAL,
      difficulty,
      language: o.language,
      authorId: o.authorId,
      source: 'ai-exam',
      timePerQuestionSeconds: 0,
      isPublished: true,
      exam: {
        ...o.exam,
        cefrLevel: o.level,
        passScore: PASS_SCORE,
        timeLimitMinutes: examMinutes(o.level),
        questionsPerAttempt: Math.min(QUESTIONS_PER_ATTEMPT, usable.length),
      },
      questions: usable.map((q, i) => ({
        text: q.text,
        type: QuestionType.MULTIPLE_CHOICE,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty ?? difficulty,
        language: o.language,
        position: i,
        explanation: q.explanation,
        feedback: q.feedback,
      })) as never,
    });
  }

  // [attemptsOf]: estado de un examen ya creado para este alumno
  private async attemptsOf(userId: string, quiz: Quiz): Promise<ExamStatus> {
    const sessions = await this.repo.listAttempts(userId, quiz.id);
    const now = new Date();
    // Intento abierto con tiempo = se puede continuar · abierto sin tiempo = cuenta como intento gastado
    const isOpen = (s: (typeof sessions)[number]) =>
      s.status === SessionStatus.IN_PROGRESS && !expired(s.startedAt, quiz.timeLimitMinutes, now);
    const open = sessions.find(isOpen);
    const finished = sessions.filter((s) => !isOpen(s));
    const gate = attemptGate(finished.map((s) => ({ startedAt: s.startedAt, passed: s.passed })), now);
    const best = finished.reduce<number | null>((m, s) => (s.percent == null ? m : Math.max(m ?? 0, s.percent)), null);
    const state: ExamState = gate.ok || open ? 'ready' : gate.reason;
    return {
      state,
      quizId: quiz.id,
      title: quiz.title,
      cefrLevel: quiz.cefrLevel,
      passScore: quiz.passScore,
      timeLimitMinutes: quiz.timeLimitMinutes,
      questions: quiz.questionsPerAttempt,
      attemptsUsed: gate.used,
      attemptsLeft: gate.left,
      retryAt: !gate.ok && gate.reason === 'wait' ? gate.retryAt!.toISOString() : null,
      bestPercent: best,
      inProgress: !!open,
    };
  }

  // [catalog · 2026-11-06]: TODOS los exámenes finales y de nivel con su estado para este alumno → la sección Exámenes los muestra con etiqueta y candado
  async catalog(userId: string): Promise<ExamCatalogItem[]> {
    await this.linkOrphanFinals();
    const rows: Array<Record<string, unknown>> = await this.db.query(
      `SELECT q.id, q.kind, q.title, q.cefr_level AS "cefrLevel", q.language::text AS language, q.course_id AS "courseId",
              q.time_limit_minutes AS "timeLimitMinutes", q.questions_per_attempt AS questions, q.pass_score AS "passScore",
              c.title AS "courseTitle", c.slug AS "courseSlug", e.progress, e.purchased_at AS "purchasedAt",
              EXISTS (SELECT 1 FROM quiz_sessions s WHERE s.quiz_id = q.id AND s.user_id = $1 AND s.passed) AS passed
       FROM quizzes q
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN course_enrollments e ON e.course_id = q.course_id AND e.user_id = $1
       WHERE q.kind IN ('final', 'level')
       ORDER BY q.kind, q.cefr_level NULLS LAST, q.title`,
      [userId],
    );
    // [2026-11-09]: cursos publicados cuyo examen final aún no se generó → también salen (bloqueados hasta el 100 %; se genera al llegar)
    const pending: Array<Record<string, unknown>> = await this.db.query(
      `SELECT c.id AS "courseId", c.title AS "courseTitle", c.slug AS "courseSlug", c.category::text AS level, c.category_group::text AS "group",
              e.progress, e.purchased_at AS "purchasedAt"
       FROM courses c
       LEFT JOIN course_enrollments e ON e.course_id = c.id AND e.user_id = $1
       WHERE c.is_published AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.course_id = c.id AND q.kind = 'final')
       ORDER BY c.category, c.title`,
      [userId],
    );
    for (const c of pending) {
      const language = COURSE_GROUP_LANGUAGE[c.group as CourseGroup];
      if (!language) continue;
      const level = isCefrLevel(String(c.level)) ? String(c.level) : null;
      rows.push({
        id: null, kind: 'final', title: `Examen final · ${String(c.courseTitle)}`, cefrLevel: level, language,
        courseId: c.courseId, courseTitle: c.courseTitle, courseSlug: c.courseSlug,
        questions: QUESTIONS_PER_ATTEMPT, timeLimitMinutes: examMinutes(level), passScore: PASS_SCORE,
        progress: c.progress, purchasedAt: c.purchasedAt, passed: false,
      });
    }
    return rows.map((r) => {
      const progress = Number(r.progress ?? 0);
      const locked = r.kind === 'final' && (!r.purchasedAt || progress < 100);
      return {
        quizId: r.id ? String(r.id) : null,
        kind: r.kind as 'final' | 'level',
        title: String(r.title),
        cefrLevel: (r.cefrLevel as string | null) ?? null,
        language: String(r.language),
        courseId: (r.courseId as string | null) ?? null,
        courseTitle: (r.courseTitle as string | null) ?? null,
        courseSlug: (r.courseSlug as string | null) ?? null,
        questions: Number(r.questions ?? 0),
        timeLimitMinutes: Number(r.timeLimitMinutes ?? 0),
        passScore: Number(r.passScore ?? PASS_SCORE),
        progress: r.kind === 'final' ? progress : null,
        enrolled: !!r.purchasedAt,
        locked,
        passed: !!r.passed,
      };
    });
  }

  // [manage · 2026-11-06]: Gestión → Certificados — cada curso (ADMIN: todos · docente: los suyos) con su examen final y si se está generando
  async manage(actor: { id: string; admin: boolean }): Promise<ExamManageRow[]> {
    const rows: Array<Record<string, unknown>> = await this.db.query(
      `SELECT c.id, c.title, c.category::text AS level, c.category_group::text AS "group", c.is_published AS published,
              q.id AS "quizId", q.title AS "quizTitle", q.is_published AS "quizPublished",
              (SELECT count(*)::int FROM questions x WHERE x.quiz_id = q.id) AS questions,
              (SELECT count(*)::int FROM quiz_sessions s WHERE s.quiz_id = q.id AND s.passed) AS passed
       FROM courses c
       LEFT JOIN quizzes q ON q.course_id = c.id AND q.kind = 'final'
       WHERE ($1::uuid IS NULL OR c.created_by = $1)
       ORDER BY c.category_group, c.category, c.title`,
      [actor.admin ? null : actor.id],
    );
    return rows.map((r) => {
      const key = `final:${String(r.id)}`;
      return {
        courseId: String(r.id),
        courseTitle: String(r.title),
        cefrLevel: isCefrLevel(String(r.level)) ? String(r.level) : null,
        language: COURSE_GROUP_LANGUAGE[r.group as CourseGroup] ?? null,
        published: !!r.published,
        quizId: (r.quizId as string | null) ?? null,
        questions: Number(r.questions ?? 0),
        passed: Number(r.passed ?? 0),
        state: r.quizId ? 'ready' : this.running.has(key) ? 'generating' : this.failed.has(key) ? 'error' : 'missing',
        message: this.failed.get(key)?.message ?? null,
      };
    });
  }

  // [generateForCourse · 2026-11-06]: el docente/ADMIN prepara el examen final al crear el curso (no hace falta esperar a que un alumno llegue al 100 %)
  async generateForCourse(actor: { id: string; admin: boolean }, courseId: string): Promise<ExamStatus> {
    const [c] = await this.db.query(`SELECT title, created_by AS "createdBy", category::text AS level FROM courses WHERE id = $1`, [courseId]);
    if (!c) throw new BadRequestException('Curso no encontrado');
    if (!actor.admin && c.createdBy !== actor.id) throw new ForbiddenException('Solo el autor del curso o un ADMIN genera su examen');
    const quiz = await this.repo.findExam({ kind: 'final', courseId });
    const base = { title: `Examen final · ${c.title}`, cefrLevel: isCefrLevel(c.level) ? c.level : null };
    if (quiz) return { ...this.empty('ready', base, 'El examen ya existe.'), quizId: quiz.id };
    this.failed.delete(`final:${courseId}`); // Reintento pedido a mano: sin esperar los 2 min
    return this.generate(`final:${courseId}`, () => this.createFinal(courseId), base);
  }

  // [attempts · 2026-11-09 · RF-32]: alumnos × examen (final o nivel) — intentos, mejor nota, espera, certificado · ADMIN: todos · docente: sus cursos
  // Entran los que ya intentaron y los que tienen el curso al 100 % (aún sin intentar) → el ADMIN ve a quién atender ante una incidencia
  async attempts(actor: { id: string; admin: boolean }, search = ''): Promise<ExamAttemptRow[]> {
    const rows: Array<Record<string, unknown>> = await this.db.query(
      `WITH pairs AS (
         SELECT s.user_id, s.quiz_id FROM quiz_sessions s JOIN quizzes q ON q.id = s.quiz_id AND q.kind IN ('final', 'level')
         UNION
         SELECT e.user_id, q.id FROM course_enrollments e JOIN quizzes q ON q.course_id = e.course_id AND q.kind = 'final' WHERE e.progress >= 100
       )
       SELECT p.user_id AS "userId", p.quiz_id AS "quizId", q.kind, q.title AS "examTitle", q.course_id AS "courseId", c.title AS "courseTitle",
              u.email, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS name, e.progress,
              e.closure_approved_at AS "closureAt", e.final_grade AS "finalGrade", e.grade_note AS "gradeNote",
              a.used, a.voided, a.best, a.passed, a.last, a.open,
              (SELECT ce.code FROM certificates ce WHERE ce.user_id = p.user_id AND ce.quiz_id = p.quiz_id AND ce.status = 'issued' LIMIT 1) AS "certCode"
       FROM pairs p
       JOIN users u ON u.id = p.user_id
       JOIN quizzes q ON q.id = p.quiz_id
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN course_enrollments e ON e.user_id = p.user_id AND e.course_id = q.course_id
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE s.voided_at IS NULL AND s.status <> 'in_progress')::int AS used,
                count(*) FILTER (WHERE s.voided_at IS NOT NULL)::int AS voided,
                max(s.percent) FILTER (WHERE s.voided_at IS NULL) AS best,
                coalesce(bool_or(s.passed), false) AS passed,
                max(s.started_at) FILTER (WHERE s.voided_at IS NULL AND s.status <> 'in_progress') AS last,
                bool_or(s.status = 'in_progress' AND s.voided_at IS NULL) AS open
         FROM quiz_sessions s WHERE s.user_id = p.user_id AND s.quiz_id = p.quiz_id) a ON true
       WHERE ($1::uuid IS NULL OR c.created_by = $1)
         AND ($2 = '' OR u.email ILIKE '%' || $2 || '%' OR CONCAT(u.first_name, ' ', u.last_name) ILIKE '%' || $2 || '%'
              OR q.title ILIKE '%' || $2 || '%' OR c.title ILIKE '%' || $2 || '%')
       ORDER BY a.last DESC NULLS LAST, u.email LIMIT 200`,
      [actor.admin ? null : actor.id, search.trim().slice(0, 80)],
    );
    const now = new Date();
    return rows.map((r) => {
      const used = Number(r.used ?? 0);
      const last = r.last ? new Date(String(r.last)) : null;
      // attemptGate solo mira cuántos hay y el más reciente → basta con `used` intentos fechados en `last`
      const gate = attemptGate(Array.from({ length: used }, () => ({ startedAt: last ?? now, passed: !!r.passed })), now);
      return {
        userId: String(r.userId),
        studentName: (r.name as string | null) ?? String(r.email),
        studentEmail: actor.admin ? String(r.email) : null,
        quizId: String(r.quizId),
        kind: r.kind as 'final' | 'level',
        examTitle: String(r.examTitle),
        courseId: (r.courseId as string | null) ?? null,
        courseTitle: (r.courseTitle as string | null) ?? null,
        progress: r.progress == null ? null : Number(r.progress),
        attemptsUsed: used,
        voided: Number(r.voided ?? 0),
        bestPercent: r.best == null ? null : Number(r.best),
        passed: !!r.passed,
        inProgress: !!r.open,
        lastAttemptAt: last?.toISOString() ?? null,
        retryAt: !gate.ok && gate.reason === 'wait' ? gate.retryAt!.toISOString() : null,
        certificateCode: (r.certCode as string | null) ?? null,
        closureApprovedAt: r.closureAt ? new Date(String(r.closureAt)).toISOString() : null,
        finalGrade: r.finalGrade == null ? null : Number(r.finalGrade),
        gradeNote: (r.gradeNote as string | null) ?? null,
      };
    });
  }

  // [resetAttempts · 2026-11-09 · RF-32]: ADMIN anula los intentos NO aprobados de un alumno (fallo técnico, corte de luz…) → vuelve a tener 3 sin espera
  // No se borran: quedan marcados con fecha, motivo y quién lo hizo (auditoría)
  async resetAttempts(adminId: string, quizId: string, userId: string, reason: string): Promise<{ voided: number }> {
    const [, voided] = await this.db.query(
      `UPDATE quiz_sessions SET voided_at = now(), void_reason = $3, voided_by = $4
       WHERE quiz_id = $1 AND user_id = $2 AND voided_at IS NULL AND passed IS NOT TRUE`,
      [quizId, userId, reason.trim().slice(0, 500), adminId],
    );
    return { voided: Number(voided ?? 0) };
  }

  private empty(state: ExamState, base: { title: string; cefrLevel: string | null }, message: string): ExamStatus {
    return {
      state,
      quizId: null,
      ...base,
      passScore: PASS_SCORE,
      timeLimitMinutes: examMinutes(base.cefrLevel),
      questions: QUESTIONS_PER_ATTEMPT,
      attemptsUsed: 0,
      attemptsLeft: 3,
      retryAt: null,
      bestPercent: null,
      inProgress: false,
      message,
    };
  }

  private async anyAdmin(): Promise<string | null> {
    const [u] = await this.db.query(`SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at LIMIT 1`);
    return u?.id ?? null;
  }
}

// [syllabusSource · 2026-11-09]: material del examen final = índice de subtemas + un trozo de CADA subtema (antes `.slice(0, 6000)` del curso
// entero dejaba fuera los últimos temas) | temario en Markdown: «## Tema» / «### Subtema» | función pura
export function syllabusSource(content: string, description: string, max = 6000): string {
  const parts = content.split(/^(?=#{2,3} )/m).map((x) => x.trim()).filter(Boolean);
  const titles = parts.map((x) => x.match(/^#{2,3} (.+)/)?.[1]?.trim()).filter(Boolean);
  if (!titles.length) return [description, content].filter(Boolean).join('\n\n').slice(0, max);
  const head = `Temario (haz preguntas de todos estos subtemas, repartidas por igual):\n- ${titles.join('\n- ')}\n\n`;
  const each = Math.max(150, Math.floor((max - head.length) / parts.length));
  return (head + parts.map((x) => x.slice(0, each)).join('\n\n')).slice(0, max);
}

const levelTitle = (language: Language, level: string): string =>
  `Examen de nivel · ${LANGUAGE_LABEL[language]} ${level}`;
