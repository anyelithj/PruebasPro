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
import { certificateQrSvg } from '../../infrastructure/pdf/certificate-qr';
import { CERTIFICATES_STORE, verifyUrlFor } from './issue-certificate.use-case';
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

  // [qrSvg · Sprint 7.8]: QR público (SVG) que lleva a /verificar/:code, con el color del nivel → tarjetas y diploma de Angular
  async qrSvg(code: string): Promise<string> {
    const cert = await this.certificates.findOneBy({
      code: code.trim().toUpperCase(),
    });
    if (!cert)
      throw new NotFoundException('No existe un certificado con ese código');
    return certificateQrSvg(verifyUrlFor(cert.code), cert.cefrLevel);
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

@Injectable()
export class ListMyCertificatesUseCase {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository,
  ) {}

  // [items + eligible]: certificados emitidos y cursos al 100 % que aún no lo tienen (botón «Solicitar» en Angular)
  async execute(userId: string): Promise<{
    items: Certificate[];
    eligible: { courseId: string; title: string }[];
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
    const eligible = ready.map((e, i) => ({
      courseId: e.courseId,
      title: courses[i]?.title ?? e.courseId,
    }));
    return { items, eligible };
  }
}

@Injectable()
export class GetCertificatePdfUseCase {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
    @Inject(CERTIFICATES_STORE) private readonly store: ObjectStore,
  ) {}

  // [Solo el dueño]: el PDF lleva su nombre → no se sirve a terceros (ellos verifican por código)
  async execute(
    userId: string,
    id: string,
  ): Promise<{ filename: string; source: RangedSource }> {
    const c = await this.certificates.findOneBy({ id, userId });
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
