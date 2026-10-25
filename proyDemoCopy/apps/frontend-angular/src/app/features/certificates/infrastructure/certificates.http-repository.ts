import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_URL } from '@core/http/api-url.token';
import { CertificatesRepository } from '../domain/certificates.repository.port';
import {
  CertificateSchema,
  MyCertificatesSchema,
  PublicCertificateSchema,
  type Certificate,
  type CertificateLookup,
  type MyCertificates,
  type PublicCertificate,
} from '../domain/models/certificates';
// [CertificatesHttpRepository · Infraestructura]: HttpClient hacia /api/certificates/* (BFF de Next.js → NestJS) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: la verificación es pública (@Public en NestJS) → sin sesión el BFF no envía Bearer · las respuestas se validan con Zod

@Injectable()
export class CertificatesHttpRepository extends CertificatesRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/certificates`;
  private readonly id = (v: string) => encodeURIComponent(v); // [Seguridad]: segmentos siempre codificados en la URL

  mine(): Observable<MyCertificates> {
    return this.http
      .get<unknown>(`${this.base}/me`)
      .pipe(map((r) => MyCertificatesSchema.parse(r)));
  }

  issue(courseId: string): Observable<Certificate> {
    return this.http
      .post<unknown>(this.base, { courseId })
      .pipe(map((r) => CertificateSchema.parse(r)));
  }

  // [verify]: código → /verify/:code · hash → /verify/tx/:hash (rutas del controlador de NestJS)
  verify(lookup: CertificateLookup): Observable<PublicCertificate> {
    const path =
      lookup.kind === 'tx'
        ? `verify/tx/${this.id(lookup.value)}`
        : `verify/${this.id(lookup.value)}`;
    return this.http
      .get<unknown>(`${this.base}/${path}`)
      .pipe(map((r) => PublicCertificateSchema.parse(r)));
  }

  qrUrl(code: string): string {
    return `${this.base}/verify/${this.id(code)}/qr`;
  }

  pdfUrl(id: string): string {
    return `${this.base}/${this.id(id)}/pdf`;
  }
}
