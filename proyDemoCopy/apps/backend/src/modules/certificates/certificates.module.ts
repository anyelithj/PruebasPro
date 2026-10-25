import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObjectStore } from '../../shared/storage/object-store';
import { CoursesModule } from '../courses/courses.module';
import { UsersModule } from '../users/users.module';
import { Web3Module } from '../web3/web3.module';
import {
  CERTIFICATES_STORE,
  IssueCertificateUseCase,
} from './application/use-cases/issue-certificate.use-case';
import { RevokeCertificateUseCase } from './application/use-cases/revoke-certificate.use-case';
import {
  GetCertificatePdfUseCase,
  ListMyCertificatesUseCase,
  VerifyCertificateUseCase,
} from './application/use-cases/verify-certificate.use-case';
import { Certificate } from './domain/entities/certificate.entity';
import { CERTIFICATE_RENDERER } from './domain/interfaces/document-renderer.interface';
import { CertificatePdfRenderer } from './infrastructure/pdf/certificate-pdf.renderer';
import { CertificatesController } from './presentation/certificates.controller';
// [CertificatesModule · Sprints 2.7/7.8]: dueño único del certificado — tabla, PDF (pdfmake + QR), almacén y anclaje/verificación en Sepolia vía Web3 | [Patrón]: Module + DI Container + Ports & Adapters | [Principio]: DRY (un solo módulo dueño) + DIP (renderizador y almacén por token)

@Module({
  imports: [
    TypeOrmModule.forFeature([Certificate]),
    CoursesModule, // COURSE_REPOSITORY: progreso del curso y título
    UsersModule, // USER_REPOSITORY: nombre impreso
    Web3Module, // AnchorCertificateHashUseCase + VerifyCertificateHashUseCase
  ],
  controllers: [CertificatesController],
  providers: [
    { provide: CERTIFICATE_RENDERER, useClass: CertificatePdfRenderer },
    {
      provide: CERTIFICATES_STORE,
      useFactory: () => createObjectStore('certificates'),
    }, // Mismo almacén que reportes y materiales (Sprint 6.7)
    IssueCertificateUseCase,
    ListMyCertificatesUseCase,
    GetCertificatePdfUseCase,
    VerifyCertificateUseCase,
    RevokeCertificateUseCase,
  ],
})
export class CertificatesModule {}
