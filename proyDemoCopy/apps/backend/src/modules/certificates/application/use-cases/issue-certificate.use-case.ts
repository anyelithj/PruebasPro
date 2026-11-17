import { randomInt } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../../courses/domain/interfaces/course.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import {
  AnchorCertificateHashUseCase,
  HASH_ANCHORED_EVENT,
  type HashAnchoredEvent,
} from '../../../web3/application/use-cases/anchor-certificate-hash.use-case';
import { isCefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { PASS_SCORE } from '../../../quiz/domain/exam-rules';
import { Certificate } from '../../domain/entities/certificate.entity';
import {
  EXAM_PASSED_EVENT,
  type ExamPassedEvent,
} from '../../../quiz/domain/events/exam-passed.event';
import {
  CERTIFICATE_RENDERER,
  type CertificateRendererPort,
  type CertificateTemplate,
} from '../../domain/interfaces/document-renderer.interface';
// [UseCase IssueCertificate · Sprints 2.7/7.8]: emite el certificado al llegar al 100 % del curso → PDF + SHA-256 + almacén + anclaje en Sepolia (cola Bull de Web3) | [Patrón]: Use Case (Command) + Idempotencia (uno por usuario y curso) + Domain Event (`web3.hash-anchored`) | [Principio]: SRP + DIP (renderizador, almacén y cadena por puertos) + DRY (anclaje de Web3) | [Paradigma]: POO + Event-Driven
// [Sin anclaje configurado]: el certificado se emite igual (verificable por código); `anchorTxHash` queda null

export const CERTIFICATES_STORE = Symbol('CERTIFICATES_STORE'); // Prefijo «certificates» del almacén de objetos (disco, MinIO o R2)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin 0/O/1/I
const block = () =>
  Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    '',
  ); // `randomInt` (crypto): aleatorio criptográfico
export const newCertificateCode = (): string => `AULA-${block()}-${block()}`;
// [Caso E · 2026-11-13]: ruta pública ÚNICA de verificación (antes /verificar/:código; esa ruta ahora redirige aquí)
export const VERIFY_PATH = '/certificados/verificar';
// [verifyUrlFor]: https://<DOMINIO>/certificados/verificar/<código> | DOMINIO = CERTIFICATE_PUBLIC_URL (o FRONTEND_URL) del entorno
// El código es aleatorio (crypto.randomInt), no consecutivo y sin datos personales → la URL no revela quién es el titular | Función pura respecto del entorno
export const verifyUrlFor = (code: string): string =>
  `${(process.env.CERTIFICATE_PUBLIC_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:9000').replace(/\/$/, '')}${VERIFY_PATH}/${encodeURIComponent(code)}`;
// [qrTarget]: la URL que lleva el QR NO cambia tras emitir → se usa la guardada en el certificado; solo los anteriores a esta versión la calculan
export const qrTarget = (cert: {
  code: string;
  verifyUrl?: string | null;
}): string => cert.verifyUrl ?? verifyUrlFor(cert.code);

@Injectable()
export class IssueCertificateUseCase {
  private readonly logger = new Logger(IssueCertificateUseCase.name);

  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(CERTIFICATE_RENDERER)
    private readonly renderer: CertificateRendererPort,
    @Inject(CERTIFICATES_STORE) private readonly store: ObjectStore,
    private readonly anchor: AnchorCertificateHashUseCase,
  ) {}

  // [2026-11-06 · Examen final]: curso al 100 % + examen final aprobado (≥ nota mínima) | `skipExam` solo para el seed de demo
  async execute(
    userId: string,
    courseId: string,
    opts: { skipExam?: boolean } = {},
  ): Promise<Certificate> {
    const existing = await this.certificates.findOneBy({ userId, courseId });
    if (existing) return existing; // [Idempotente]: pedirlo otra vez devuelve el mismo
    const [course, enrollment, user] = await Promise.all([
      this.courses.findById(courseId),
      this.courses.getEnrollment(userId, courseId),
      this.users.findById(userId),
    ]);
    if (!course || !user) throw new NotFoundException('Curso no encontrado');
    if (!enrollment?.purchasedAt || enrollment.progress < 100)
      throw new ConflictException(
        'El certificado se emite al completar el 100 % del curso',
      );
    const exam = opts.skipExam
      ? null
      : await this.passedExam(
          userId,
          `q.course_id = $2 AND q.kind = 'final'`,
          courseId,
        );
    // [2026-11-09 · RF-32]: la nota final corregida por el docente manda sobre la del examen
    const grade = enrollment.finalGrade ?? exam?.percent ?? null;
    if (
      !opts.skipExam &&
      (grade == null ||
        (enrollment.finalGrade != null ? grade < PASS_SCORE : !exam))
    )
      throw new ConflictException(
        'El certificado se emite al aprobar el examen final del curso',
      );
    // [2026-11-09 · RF-32 · Emisión condicionada]: el docente valida el cierre académico antes de que NestJS emita el certificado
    if (!opts.skipExam && !enrollment.closureApprovedAt)
      throw new ConflictException(
        'Examen aprobado: falta que el docente valide el cierre académico del curso',
      );
    const cefrLevel = isCefrLevel(String(course.category)) // Cursos de idiomas: category = 'A1'…'C2'
      ? String(course.category)
      : null;
    return this.emit(user, {
      userId,
      courseId,
      quizId: exam?.quizId ?? null,
      examScore: grade,
      title: course.title,
      cefrLevel,
      kind: 'course',
    });
  }

  // [issueLevel · 2026-11-06]: certificado de NIVEL (examen de nivel aprobado, sin curso) · idempotente por usuario y examen
  async issueLevel(userId: string, quizId: string): Promise<Certificate> {
    const existing = await this.certificates.findOneBy({
      userId,
      quizId,
      courseId: IsNull(),
    });
    if (existing) return existing;
    const [user, exam, quiz] = await Promise.all([
      this.users.findById(userId),
      this.passedExam(userId, `q.id = $2 AND q.kind = 'level'`, quizId),
      this.certificates
        .query(
          `SELECT title, cefr_level AS "cefrLevel" FROM quizzes WHERE id = $1`,
          [quizId],
        )
        .then((r: Array<{ title: string; cefrLevel: string | null }>) => r[0]),
    ]);
    if (!user || !quiz) throw new NotFoundException('Examen no encontrado');
    if (!exam)
      throw new ConflictException(
        'Aprueba el examen de nivel para obtener el certificado',
      );
    return this.emit(user, {
      userId,
      courseId: null,
      quizId,
      examScore: exam.percent,
      title: quiz.title,
      cefrLevel: quiz.cefrLevel,
      kind: 'level',
    });
  }

  // [issueManual · 2026-11-09 · RF-32]: emisión por EXCEPCIÓN (ADMIN) — incidencia técnica o validación especial del docente: sin exigir 100 % ni examen
  // El motivo queda en `adminNotes` (auditoría) · idempotente: si ya existe, se devuelve el mismo
  async issueManual(
    email: string,
    courseId: string,
    reason: string,
  ): Promise<Certificate> {
    const [user, course] = await Promise.all([
      this.users.findByEmail(email.trim().toLowerCase()),
      this.courses.findById(courseId),
    ]);
    if (!user)
      throw new NotFoundException('No hay ningún alumno con ese correo');
    if (!course) throw new NotFoundException('Curso no encontrado');
    const existing = await this.certificates.findOneBy({
      userId: user.id,
      courseId,
    });
    if (existing)
      throw new ConflictException(
        `Ese alumno ya tiene el certificado de este curso (${existing.code})`,
      );
    const exam = await this.passedExam(
      user.id,
      `q.course_id = $2 AND q.kind = 'final'`,
      courseId,
    );
    return this.emit(
      user,
      {
        userId: user.id,
        courseId,
        quizId: exam?.quizId ?? null,
        examScore: exam?.percent ?? null,
        title: course.title,
        cefrLevel: isCefrLevel(String(course.category))
          ? String(course.category)
          : null,
        kind: 'course',
      },
      `Emisión manual (${new Date().toISOString().slice(0, 10)}): ${reason}`,
    );
  }

  // [reissue · 2026-11-09 · RF-32]: corregir el NOMBRE del alumno o del curso impreso en el PDF → nuevo PDF, nuevo código, nuevo SHA-256 y nuevo anclaje
  // (el PDF firmado no se puede editar sin romper su hash) · el código anterior y el motivo quedan en las notas de auditoría
  // ponytail: se reemplaza en la misma fila (índice único usuario+curso); historial de versiones en tabla aparte si auditoría lo exige
  async reissue(
    id: string,
    fix: { recipientName?: string; courseTitle?: string },
    reason: string,
  ): Promise<Certificate> {
    const c = await this.certificates.findOneBy({ id });
    if (!c) throw new NotFoundException('Certificado no encontrado');
    if (c.status === 'revoked')
      throw new ConflictException(
        'Un certificado revocado no se reemite: emítelo de nuevo manualmente',
      );
    const oldCode = c.code;
    const recipientName = fix.recipientName?.trim() || c.recipientName;
    const courseTitle = fix.courseTitle?.trim() || c.courseTitle;
    const code = newCertificateCode();
    const { pdf, objectKey, verifyUrl } = await this.render(c.userId, {
      code,
      recipientName,
      title: courseTitle,
      cefrLevel: c.cefrLevel,
      issuedAt: c.issuedAt,
      kind: c.courseId ? 'course' : 'level',
      examScore: c.examScore,
    });
    Object.assign(c, {
      code,
      verifyUrl, // Código nuevo → URL nueva (la anterior deja de verificar: el PDF viejo queda invalidado)
      recipientName,
      courseTitle,
      pdfSha256: pdf.sha256,
      objectKey,
      sizeBytes: pdf.bytes.length,
      anchorTxHash: null,
      adminNotes: [
        c.adminNotes,
        `Reemitido ${new Date().toISOString().slice(0, 10)} (antes ${oldCode}): ${reason}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
    const saved = await this.certificates.save(c);
    await this.anchor
      .execute(pdf.sha256, saved.id)
      .catch((err: unknown) =>
        this.logger.warn(`Certificado ${code} sin anclar: ${String(err)}`),
      );
    return saved;
  }

  // [approveClosure · 2026-11-09 · RF-32]: el docente (de SU curso) o el ADMIN aprueba —o retira— el cierre académico del alumno
  // Aprobar = gatillo: si ya cumple 100 % + examen/nota, el certificado se emite al momento | devuelve el certificado o por qué aún no
  async approveClosure(
    actor: { id: string; admin: boolean },
    userId: string,
    courseId: string,
    approve: boolean,
  ) {
    await this.assertCourseScope(actor, courseId);
    const [, n] = await this.certificates.query(
      `UPDATE course_enrollments SET closure_approved_at = CASE WHEN $3 THEN now() END, closure_approved_by = CASE WHEN $3 THEN $4::uuid END
       WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId, approve, actor.id],
    );
    if (!Number(n))
      throw new NotFoundException('El alumno no está inscrito en ese curso');
    return approve
      ? this.tryIssue(userId, courseId)
      : { certificate: null, pending: 'Cierre académico retirado' };
  }

  // [setGrade · 2026-11-09 · RF-32]: el docente corrige la nota final (0–100) → recalcula la elegibilidad y, si ya está aprobado el cierre, emite
  async setGrade(
    actor: { id: string; admin: boolean },
    userId: string,
    courseId: string,
    grade: number | null,
    note: string,
  ) {
    await this.assertCourseScope(actor, courseId);
    const [, n] = await this.certificates.query(
      `UPDATE course_enrollments SET final_grade = $3, grade_note = $4, grade_by = $5 WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId, grade, note.trim().slice(0, 500) || null, actor.id],
    );
    if (!Number(n))
      throw new NotFoundException('El alumno no está inscrito en ese curso');
    return this.tryIssue(userId, courseId);
  }

  private async tryIssue(
    userId: string,
    courseId: string,
  ): Promise<{ certificate: Certificate | null; pending: string | null }> {
    try {
      return {
        certificate: await this.execute(userId, courseId),
        pending: null,
      };
    } catch (err) {
      if (err instanceof ConflictException)
        return { certificate: null, pending: err.message };
      throw err;
    }
  }

  private async assertCourseScope(
    actor: { id: string; admin: boolean },
    courseId: string,
  ): Promise<void> {
    const course = await this.courses.findById(courseId);
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (!actor.admin && course.createdBy !== actor.id)
      throw new ForbiddenException('Solo los alumnos de tus cursos');
  }

  // [onExamPassed]: aprobar el examen final o de nivel emite el certificado SIN pedirlo | [Patrón]: Observer | fail-soft (queda «Solicitar»)
  @OnEvent(EXAM_PASSED_EVENT)
  async onExamPassed(e: ExamPassedEvent): Promise<void> {
    await (
      e.courseId
        ? this.execute(e.userId, e.courseId)
        : this.issueLevel(e.userId, e.quizId)
    ).catch((err: unknown) =>
      this.logger.warn(
        `Certificado automático no emitido (${e.quizId}): ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  // [passedExam]: mejor % de los intentos aprobados del examen que cumple `where` ($1 = usuario, $2 = curso o examen)
  private async passedExam(
    userId: string,
    where: string,
    id: string,
  ): Promise<{ quizId: string; percent: number } | null> {
    const rows: Array<{ quizId: string; percent: number }> =
      await this.certificates.query(
        `SELECT s.quiz_id AS "quizId", MAX(s.percent)::int AS percent FROM quiz_sessions s JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.user_id = $1 AND s.passed = true AND ${where} GROUP BY s.quiz_id ORDER BY percent DESC LIMIT 1`,
        [userId, id],
      );
    return rows[0] ?? null;
  }

  private async emit(
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    },
    c: {
      userId: string;
      courseId: string | null;
      quizId: string | null;
      examScore: number | null;
      title: string;
      cefrLevel: string | null;
      kind: 'course' | 'level';
    },
    adminNotes: string | null = null,
  ): Promise<Certificate> {
    const code = newCertificateCode();
    const issuedAt = new Date();
    const recipientName =
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
      user.email.split('@')[0];
    const { pdf, objectKey, verifyUrl } = await this.render(c.userId, {
      code,
      recipientName,
      title: c.title,
      cefrLevel: c.cefrLevel,
      issuedAt,
      kind: c.kind,
      examScore: c.examScore,
    });
    const cert = await this.certificates.save(
      this.certificates.create({
        userId: c.userId,
        courseId: c.courseId,
        quizId: c.quizId,
        examScore: c.examScore,
        code,
        verifyUrl, // [Caso E]: fija la URL del QR en el momento de emitir
        recipientName,
        courseTitle: c.title,
        cefrLevel: c.cefrLevel,
        pdfSha256: pdf.sha256,
        objectKey,
        sizeBytes: pdf.bytes.length,
        anchorTxHash: null,
        status: 'issued',
        revokeReason: null,
        revokedAt: null,
        adminNotes,
        issuedAt,
      }),
    );
    // [Anclaje]: en segundo plano; si no hay clave de la plataforma (503) el certificado sigue siendo válido por código
    await this.anchor
      .execute(pdf.sha256, cert.id)
      .catch((err: unknown) =>
        this.logger.warn(
          `Certificado ${code} sin anclar: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    return cert;
  }

  // [render]: PDF + almacén (lo comparten la emisión y la reemisión) | [Principio]: DRY
  private async render(
    userId: string,
    d: {
      code: string;
      recipientName: string;
      title: string;
      cefrLevel: string | null;
      issuedAt: Date;
      kind: 'course' | 'level';
      examScore: number | null;
    },
  ) {
    const verifyUrl = verifyUrlFor(d.code); // Se calcula UNA vez: va al QR del PDF y se guarda en el certificado
    const pdf = await this.renderer.render({
      code: d.code,
      recipientName: d.recipientName,
      courseTitle: d.title,
      cefrLevel: d.cefrLevel,
      issuedAt: d.issuedAt,
      verifyUrl,
      kind: d.kind,
      examScore: d.examScore,
      template: await this.template(),
    });
    const objectKey = `${userId}/${d.code}.${pdf.extension}`;
    await this.store.put(objectKey, pdf.bytes, pdf.contentType);
    return { pdf, objectKey, verifyUrl };
  }

  // [template · 2026-11-09 · RF-32]: plantilla del ADMIN (sin tabla aún → valores por defecto del PDF)
  private async template(): Promise<CertificateTemplate | undefined> {
    const rows: CertificateTemplate[] = await this.certificates
      .query(
        `SELECT institution, signer_name AS "signerName", signer_title AS "signerTitle", legal_text AS "legalText" FROM certificate_template WHERE id = 1`,
      )
      .catch(() => []);
    return rows[0];
  }

  // [onHashAnchored]: el worker de Web3 avisa el hash de la transacción → se guarda en el certificado | [Patrón]: Observer
  @OnEvent(HASH_ANCHORED_EVENT)
  async onHashAnchored(e: HashAnchoredEvent): Promise<void> {
    await this.certificates.update(
      { id: e.ref, pdfSha256: e.hash },
      { anchorTxHash: e.txHash },
    );
  }
}
