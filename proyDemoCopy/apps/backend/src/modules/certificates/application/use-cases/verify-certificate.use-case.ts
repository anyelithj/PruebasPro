import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RangedSource } from '../../../../shared/http/ranged-response';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../../courses/domain/interfaces/course.repository.interface';
import { VerifyCertificateHashUseCase } from '../../../web3/application/use-cases/verify-certificate-hash.use-case';
import { Certificate } from '../../domain/entities/certificate.entity';
import {
  COURSE_GROUP_LANGUAGE,
  type CourseGroup,
} from '../../../courses/domain/value-objects/course-category.vo';
import { certificateQrSvg } from '../../infrastructure/pdf/certificate-qr';
import { CERTIFICATES_STORE, qrTarget } from './issue-certificate.use-case';
// [UseCases VerifyCertificate + ListMyCertificates + GetCertificatePdf · Sprints 2.7/7.8 · RF-32 · RF-93]: verificación PÚBLICA por código o por hash de transacción (compara en Sepolia el hash anclado con el del PDF), lista del dueño y descarga del PDF | [Patrón]: Query (CQRS ligero) + DTO público (sin datos sensibles) | [Principio]: SRP + DRY (lectura on-chain de Web3) + mínimo privilegio | [Paradigma]: POO + async/await

// [Vista pública]: lo que cualquiera puede ver al verificar (sin email, ids internos ni ruta del archivo)
export interface PublicCertificate {
  valid: boolean; // emitido, no revocado y (si está anclado) coincide en la cadena
  status: 'issued' | 'revoked';
  code: string;
  recipientName: string;
  courseTitle: string;
  cefrLevel: string | null; // Banda MCER → color del diploma público
  issuedAt: string;
  pdfSha256: string;
  anchor: {
    txHash: string;
    onchainValid: boolean;
    confirmations: number;
  } | null;
  revokeReason: string | null;
}

@Injectable()
export class VerifyCertificateUseCase {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
    private readonly onchain: VerifyCertificateHashUseCase,
  ) {}

  async byCode(code: string): Promise<PublicCertificate> {
    const cert = await this.certificates.findOneBy({
      code: code.trim().toUpperCase(),
    });
    if (!cert)
      throw new NotFoundException('No existe un certificado con ese código');
    return this.toPublic(cert);
  }

  async byTx(txHash: string): Promise<PublicCertificate> {
    const cert = await this.certificates.findOneBy({
      anchorTxHash: txHash.toLowerCase(),
    });
    if (!cert)
      throw new NotFoundException(
        'Esa transacción no ancla ningún certificado de la plataforma',
      );
    return this.toPublic(cert);
  }

  // [qrSvg · Sprint 7.8 → Caso E]: QR público (SVG) que lleva a /certificados/verificar/:code (o a la URL fijada al emitir), con el color del nivel → tarjetas y diploma de Angular
  async qrSvg(code: string): Promise<string> {
    const cert = await this.certificates.findOneBy({
      code: code.trim().toUpperCase(),
    });
    if (!cert)
      throw new NotFoundException('No existe un certificado con ese código');
    return certificateQrSvg(qrTarget(cert), cert.cefrLevel); // [Caso E]: la MISMA URL que lleva el QR del PDF
  }

  // [toPublic]: si está anclado, la cadena manda — un PDF alterado o una transacción ajena dan `onchainValid: false`
  private async toPublic(c: Certificate): Promise<PublicCertificate> {
    const chain = c.anchorTxHash
      ? await this.onchain
          .execute(c.anchorTxHash, c.pdfSha256)
          .catch(() => ({ valid: false, confirmations: 0 }))
      : null;
    return {
      valid: c.status === 'issued' && (chain?.valid ?? true),
      status: c.status,
      code: c.code,
      recipientName: c.recipientName,
      courseTitle: c.courseTitle,
      cefrLevel: c.cefrLevel,
      issuedAt: c.issuedAt.toISOString(),
      pdfSha256: c.pdfSha256,
      anchor: c.anchorTxHash
        ? {
            txHash: c.anchorTxHash,
            onchainValid: chain?.valid ?? false,
            confirmations: chain?.confirmations ?? 0,
          }
        : null,
      revokeReason: c.revokeReason,
    };
  }
}

// [languageFromTitle]: «Examen de nivel · Inglés A1» → 'en' | Pura
const TITLE_LANGUAGE: ReadonlyArray<[RegExp, string]> = [
  [/ingl[eé]s|english/i, 'en'],
  [/franc[eé]s|french/i, 'fr'],
  [/alem[aá]n|german/i, 'de'],
  [/portugu[eé]s|portuguese/i, 'pt'],
  [/chino|mandar[ií]n|chinese/i, 'zh'],
  [/ruso|russian/i, 'ru'],
  [/espa[nñ]ol|spanish/i, 'es'],
];
const languageFromTitle = (title: string): string | null =>
  TITLE_LANGUAGE.find(([re]) => re.test(title))?.[1] ?? null;

@Injectable()
export class ListMyCertificatesUseCase {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository,
  ) {}

  // [items + eligible]: certificados emitidos y cursos al 100 % que aún no lo tienen (botón «Solicitar» en Angular)
  async execute(userId: string): Promise<{
    items: (Certificate & { language: string | null })[];
    eligible: { courseId: string; title: string; examPassed: boolean }[];
  }> {
    const [items, enrollments] = await Promise.all([
      this.certificates.find({
        where: { userId },
        order: { issuedAt: 'DESC' },
      }),
      this.courses.listEnrollmentsByUser(userId),
    ]);
    const done = new Set(items.map((c) => c.courseId));
    const ready = enrollments.filter(
      (e) => e.purchasedAt && e.progress >= 100 && !done.has(e.courseId),
    );
    // [Títulos]: las inscripciones no cargan la relación `course` → se leen los cursos listos (pocos: solo los completados)
    const courses = await Promise.all(
      ready.map((e) => this.courses.findById(e.courseId)),
    );
    // [2026-11-06]: el certificado exige el examen final aprobado → `examPassed` false = la UI enlaza al examen en vez de «Solicitar»
    const passed: Array<{ courseId: string }> = ready.length
      ? await this.certificates.query(
          `SELECT DISTINCT q.course_id AS "courseId" FROM quiz_sessions s JOIN quizzes q ON q.id = s.quiz_id
           WHERE s.user_id = $1 AND s.passed = true AND q.kind = 'final' AND q.course_id = ANY($2)`,
          [userId, ready.map((e) => e.courseId)],
        )
      : [];
    const ok = new Set(passed.map((r) => r.courseId));
    const eligible = ready.map((e, i) => ({
      courseId: e.courseId,
      title: courses[i]?.title ?? e.courseId,
      examPassed: ok.has(e.courseId),
    }));
    // [Idioma · 2026-11-13]: filtro por idioma en «Mis certificados» → idioma del grupo del curso; certificado de nivel → por el nombre del idioma en su título
    // ponytail: detección por título en los de nivel (no guardan idioma); columna `language` en certificates si hiciera falta exactitud
    const courseIds = items
      .map((c) => c.courseId)
      .filter((id): id is string => !!id);
    const groups: Array<{ id: string; group: string }> = courseIds.length
      ? await this.certificates.query(
          `SELECT id, category_group::text AS "group" FROM courses WHERE id = ANY($1)`,
          [courseIds],
        )
      : [];
    const groupOf = new Map(groups.map((g) => [g.id, g.group]));
    const withLanguage = items.map((c) =>
      Object.assign(c, {
        language: c.courseId
          ? (COURSE_GROUP_LANGUAGE[groupOf.get(c.courseId) as CourseGroup] ??
            null)
          : languageFromTitle(c.courseTitle),
      }),
    );
    return { items: withLanguage, eligible };
  }
}

// [ListIssuedCertificates · 2026-11-06]: Gestión → Certificados — últimos emitidos (búsqueda por código, nombre o curso) | ADMIN: todos · docente: los de sus cursos
@Injectable()
export class GetCertificatePdfUseCase {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
    @Inject(CERTIFICATES_STORE) private readonly store: ObjectStore,
  ) {}

  // [Solo el dueño]: el PDF lleva su nombre → no se sirve a terceros (ellos verifican por código)
  async execute(
    userId: string | null, // null = personal autorizado (el controlador ya validó el alcance)
    id: string,
  ): Promise<{ filename: string; source: RangedSource }> {
    const c = await this.certificates.findOneBy(
      userId ? { id, userId } : { id },
    );
    if (!c) throw new NotFoundException('Certificado no encontrado');
    const filename = `certificado-${c.code}.pdf`;
    const key = c.objectKey;
    return {
      filename,
      source: {
        size: c.sizeBytes,
        contentType: 'application/pdf',
        open: (range) => this.store.open(key, range),
        signedUrl: await this.store.signedUrl(key, {
          filename,
          contentType: 'application/pdf',
          disposition: 'attachment',
        }),
      },
    };
  }
}
