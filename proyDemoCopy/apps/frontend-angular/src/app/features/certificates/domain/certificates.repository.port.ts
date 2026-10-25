import type { Observable } from 'rxjs';
import type {
  Certificate,
  CertificateLookup,
  MyCertificates,
  PublicCertificate,
} from './models/certificates';
// [Puerto CertificatesRepository · Dominio]: solicitar, listar, descargar y verificar certificados | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class CertificatesRepository {
  abstract mine(): Observable<MyCertificates>;
  abstract issue(courseId: string): Observable<Certificate>;
  abstract verify(lookup: CertificateLookup): Observable<PublicCertificate>;
  abstract qrUrl(code: string): string; // [Sprint 7.8]: QR público (SVG generado con qrcode en NestJS, color del nivel)
  abstract pdfUrl(id: string): string; // Enlace de descarga (el navegador sigue la 302 a la URL firmada)
}
