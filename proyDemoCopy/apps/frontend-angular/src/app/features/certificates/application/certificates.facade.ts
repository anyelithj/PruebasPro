import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, throwError } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { CertificatesRepository } from '../domain/certificates.repository.port';
import {
  parseLookup,
  type Certificate,
  type MyCertificates,
  type PublicCertificate,
} from '../domain/models/certificates';
// [CertificatesFacade · Aplicación]: casos de uso «mis certificados», «solicitar», «descargar» y «verificar» (público) | [Patrón]: Facade + State Machine (AsyncState) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await
// [UX]: tras solicitar se relee la lista (el curso pasa de «listo» a «emitido» con el estado real del backend)

@Injectable()
export class CertificatesFacade {
  private readonly repo = inject(CertificatesRepository);

  readonly mine = new AsyncState<MyCertificates>(
    (d) => d.items.length === 0 && d.eligible.length === 0,
  );
  readonly verification = new AsyncState<PublicCertificate>();
  readonly issuing = signal<string | null>(null); // courseId en curso → deshabilita solo ese botón
  readonly actionError = signal<string | null>(null);

  load(): Promise<MyCertificates | null> {
    return this.mine.run(this.repo.mine());
  }

  async request(courseId: string): Promise<Certificate | null> {
    this.issuing.set(courseId);
    this.actionError.set(null);
    try {
      const cert = await firstValueFrom(this.repo.issue(courseId));
      await this.load();
      return cert;
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.issuing.set(null);
    }
  }

  // [verify]: formato inválido → error local sin petición (`invalidMessage` lo traduce la página)
  verify(raw: string, invalidMessage: string): Promise<PublicCertificate | null> {
    const lookup = parseLookup(raw);
    return this.verification.run(
      lookup ? this.repo.verify(lookup) : throwError(() => new Error(invalidMessage)),
    );
  }

  qrUrl(code: string): string {
    return this.repo.qrUrl(code);
  }

  pdfUrl(id: string): string {
    return this.repo.pdfUrl(id);
  }
}
