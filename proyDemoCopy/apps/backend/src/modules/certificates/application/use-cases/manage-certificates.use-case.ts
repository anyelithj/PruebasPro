import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from '../../domain/entities/certificate.entity';
// [UseCase ManageCertificates · 2026-11-09 · RF-32]: Gestión → Certificados — bandeja con filtros, detalle, metadatos (ADMIN) y solicitud de revocación (DOCENTE)
// [Permisos]: ADMIN ve y gestiona todo · DOCENTE solo los certificados de los cursos que creó (ve detalle y pide revocar; no revoca ni edita)
// [Patrón]: Use Case + Guard de propiedad | [Principio]: mínimo privilegio + SRP (emitir/reemitir viven en IssueCertificateUseCase)

export interface CertActor {
  id: string;
  admin: boolean;
}

export interface IssuedFilters {
  search?: string;
  status?: 'issued' | 'revoked' | 'pending' | 'requested'; // pending = sin anclar en Sepolia · requested = revocación pedida por un docente
  courseId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
}

const ETHERSCAN = (process.env.ETHERSCAN_URL ?? 'https://sepolia.etherscan.io').replace(/\/$/, '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

@Injectable()
export class ManageCertificatesUseCase {
  constructor(@InjectRepository(Certificate) private readonly certificates: Repository<Certificate>) {}

  // [list]: bandeja general con filtros (curso, estado, fechas, texto) · docente → solo sus cursos
  list(actor: CertActor, f: IssuedFilters = {}): Promise<unknown[]> {
    const status = f.status && ['issued', 'revoked', 'pending', 'requested'].includes(f.status) ? f.status : null;
    return this.certificates.query(
      `SELECT c.id, c.code, c.recipient_name AS "recipientName", c.course_title AS "courseTitle", c.cefr_level AS "cefrLevel",
              c.exam_score AS "examScore", c.status, c.revoke_reason AS "revokeReason", c.issued_at AS "issuedAt", c.course_id AS "courseId",
              c.anchor_tx_hash AS "anchorTxHash", c.revoke_request_reason AS "revokeRequestReason",
              NULLIF(TRIM(CONCAT(t.first_name, ' ', t.last_name)), '') AS "teacherName"
       FROM certificates c
       LEFT JOIN courses k ON k.id = c.course_id
       LEFT JOIN users t ON t.id = k.created_by
       WHERE ($1::uuid IS NULL OR k.created_by = $1)
         AND ($2 = '' OR c.code ILIKE '%' || $2 || '%' OR c.recipient_name ILIKE '%' || $2 || '%' OR c.course_title ILIKE '%' || $2 || '%'
              OR CONCAT(t.first_name, ' ', t.last_name) ILIKE '%' || $2 || '%')
         AND ($3::text IS NULL
              OR ($3 = 'issued' AND c.status = 'issued')
              OR ($3 = 'revoked' AND c.status = 'revoked')
              OR ($3 = 'pending' AND c.status = 'issued' AND c.anchor_tx_hash IS NULL)
              OR ($3 = 'requested' AND c.status = 'issued' AND c.revoke_requested_at IS NOT NULL))
         AND ($4::uuid IS NULL OR c.course_id = $4)
         AND ($5::date IS NULL OR c.issued_at >= $5::date)
         AND ($6::date IS NULL OR c.issued_at < $6::date + 1)
       ORDER BY c.revoke_requested_at DESC NULLS LAST, c.issued_at DESC LIMIT 200`,
      [
        actor.admin ? null : actor.id,
        (f.search ?? '').trim().slice(0, 80),
        status,
        f.courseId && UUID.test(f.courseId) ? f.courseId : null,
        f.from && DATE.test(f.from) ? f.from : null,
        f.to && DATE.test(f.to) ? f.to : null,
      ],
    );
  }

  // [detail]: todo lo del certificado + alumno, docente, avance y enlace al explorador (Etherscan) · el email del alumno solo al ADMIN
  async detail(actor: CertActor, id: string) {
    const rows: Array<Record<string, unknown>> = await this.certificates.query(
      `SELECT c.*, u.email AS "studentEmail", k.created_by AS "teacherId", k.title AS "currentCourseTitle",
              NULLIF(TRIM(CONCAT(t.first_name, ' ', t.last_name)), '') AS "teacherName", e.progress
       FROM certificates c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN courses k ON k.id = c.course_id
       LEFT JOIN users t ON t.id = k.created_by
       LEFT JOIN course_enrollments e ON e.user_id = c.user_id AND e.course_id = c.course_id
       WHERE c.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Certificado no encontrado');
    if (!actor.admin && r.teacherId !== actor.id) throw new ForbiddenException('Solo los certificados de tus cursos');
    const tx = (r.anchor_tx_hash as string | null) ?? null;
    return {
      id: r.id,
      code: r.code,
      status: r.status === 'revoked' ? 'revoked' : tx ? 'valid' : 'pending',
      recipientName: r.recipient_name,
      studentEmail: actor.admin ? r.studentEmail : null,
      courseId: r.course_id,
      courseTitle: r.course_title,
      currentCourseTitle: r.currentCourseTitle ?? null,
      cefrLevel: r.cefr_level,
      examScore: r.exam_score,
      quizId: r.quiz_id,
      progress: r.progress ?? null,
      teacherName: r.teacherName ?? null,
      pdfSha256: r.pdf_sha256,
      sizeBytes: r.size_bytes,
      anchorTxHash: tx,
      explorerUrl: tx ? `${ETHERSCAN}/tx/${tx}` : null,
      issuedAt: r.issued_at,
      revokeReason: r.revoke_reason,
      revokedAt: r.revoked_at,
      revokeRequestReason: r.revoke_request_reason,
      revokeRequestedAt: r.revoke_requested_at,
      adminNotes: actor.admin ? r.admin_notes : null,
    };
  }

  // [updateMetadata]: SOLO campos de control (notas de auditoría) — el nombre y el curso impresos se corrigen con «Reemitir» (nuevo PDF y hash)
  async updateMetadata(id: string, patch: { adminNotes?: string }): Promise<Certificate> {
    const c = await this.certificates.findOneBy({ id });
    if (!c) throw new NotFoundException('Certificado no encontrado');
    if (patch.adminNotes !== undefined) c.adminNotes = patch.adminNotes.trim() || null;
    return this.certificates.save(c);
  }

  // [template · 2026-11-09 · RF-32]: plantilla del PDF (institución, firma autorizada, texto legal) — afecta a los certificados que se emitan o reemitan desde ahora
  async getTemplate() {
    const [t] = await this.certificates.query(
      `SELECT institution, signer_name AS "signerName", signer_title AS "signerTitle", legal_text AS "legalText", updated_at AS "updatedAt" FROM certificate_template WHERE id = 1`,
    );
    return t ?? { institution: 'AULA DE IDIOMAS', signerName: null, signerTitle: null, legalText: null, updatedAt: null };
  }

  async saveTemplate(t: { institution: string; signerName?: string; signerTitle?: string; legalText?: string }) {
    const clean = (s?: string) => s?.trim() || null;
    await this.certificates.query(
      `INSERT INTO certificate_template (id, institution, signer_name, signer_title, legal_text, updated_at) VALUES (1, $1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE SET institution = $1, signer_name = $2, signer_title = $3, legal_text = $4, updated_at = now()`,
      [t.institution.trim(), clean(t.signerName), clean(t.signerTitle), clean(t.legalText)],
    );
    return this.getTemplate();
  }

  // [requestRevocation]: el docente del curso pide revocar con su justificación (trampa, error académico…) → el ADMIN la ve primero en la bandeja
  async requestRevocation(actor: CertActor, id: string, reason: string): Promise<{ ok: true }> {
    await this.detail(actor, id); // Guard: existe y es de sus cursos
    await this.certificates.update(
      { id, status: 'issued' },
      { revokeRequestReason: reason.trim(), revokeRequestedBy: actor.id, revokeRequestedAt: new Date() },
    );
    return { ok: true };
  }
}
