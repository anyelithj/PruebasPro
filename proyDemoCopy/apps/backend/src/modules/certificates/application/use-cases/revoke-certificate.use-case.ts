import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from '../../domain/entities/certificate.entity';
// [UseCase RevokeCertificate · Sprint 7.8]: un ADMIN revoca un certificado (p. ej. tras un reembolso o fraude) con motivo auditable | [Patrón]: Use Case (Command) + State (issued → revoked) | [Principio]: SRP | [Paradigma]: POO + async/await
// [Cadena]: el anclaje en Sepolia no se puede borrar; la verificación pública mostrará «revocado» aunque el hash coincida

@Injectable()
export class RevokeCertificateUseCase {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
  ) {}

  async execute(id: string, reason: string): Promise<Certificate> {
    const c = await this.certificates.findOneBy({ id });
    if (!c) throw new NotFoundException('Certificado no encontrado');
    if (c.status === 'revoked') return c; // Idempotente
    c.status = 'revoked';
    c.revokeReason = reason;
    c.revokedAt = new Date();
    return this.certificates.save(c);
  }
}
