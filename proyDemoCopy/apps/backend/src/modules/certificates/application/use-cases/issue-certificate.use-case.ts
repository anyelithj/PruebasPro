import { randomInt } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { Certificate } from '../../domain/entities/certificate.entity';
import {
  CERTIFICATE_RENDERER,
  type CertificateRendererPort,
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
export const verifyUrlFor = (code: string): string =>
  `${(process.env.FRONTEND_URL ?? 'http://localhost:9000').replace(/\/$/, '')}/verificar/${code}`; // Pantalla pública de Angular (ANGULAR_PUBLIC_PREFIXES): sin sesión

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

  async execute(userId: string, courseId: string): Promise<Certificate> {
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

    const code = newCertificateCode();
    const issuedAt = new Date();
    const recipientName =
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
      user.email.split('@')[0];
    const cefrLevel = isCefrLevel(String(course.category)) // Cursos de idiomas: category = 'A1'…'C2'
      ? String(course.category)
      : null;
    const pdf = await this.renderer.render({
      code,
      recipientName,
      courseTitle: course.title,
      cefrLevel,
      issuedAt,
      verifyUrl: verifyUrlFor(code),
    });
    const objectKey = `${userId}/${code}.${pdf.extension}`;
    await this.store.put(objectKey, pdf.bytes, pdf.contentType);
    const cert = await this.certificates.save(
      this.certificates.create({
        userId,
        courseId,
        code,
        recipientName,
        courseTitle: course.title,
        cefrLevel,
        pdfSha256: pdf.sha256,
        objectKey,
        sizeBytes: pdf.bytes.length,
        anchorTxHash: null,
        status: 'issued',
        revokeReason: null,
        revokedAt: null,
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

  // [onHashAnchored]: el worker de Web3 avisa el hash de la transacción → se guarda en el certificado | [Patrón]: Observer
  @OnEvent(HASH_ANCHORED_EVENT)
  async onHashAnchored(e: HashAnchoredEvent): Promise<void> {
    await this.certificates.update(
      { id: e.ref, pdfSha256: e.hash },
      { anchorTxHash: e.txHash },
    );
  }
}
