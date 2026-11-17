// [Port CertificateRendererPort · Sprint 7.8]: contrato para generar el documento del certificado (PDF hoy; otro formato mañana) | [Patrón]: Port (Hexagonal) + Strategy | [Principio]: DIP (el caso de uso no conoce pdfmake) + OCP | [Paradigma]: POO

export const CERTIFICATE_RENDERER = Symbol('CERTIFICATE_RENDERER');

// [Datos impresos]: solo lo público del certificado + URL de verificación (va en el QR)
export interface CertificateDocument {
  code: string;
  recipientName: string;
  courseTitle: string;
  cefrLevel: string | null; // A1–C2 → color del diploma (null = morado de marca)
  issuedAt: Date;
  verifyUrl: string;
  kind?: 'course' | 'level'; // [2026-11-06]: level → «aprobó el examen de nivel» (sin curso)
  examScore?: number | null; // % del examen final o de nivel
  template?: CertificateTemplate; // [2026-11-09 · RF-32]: textos configurables por el ADMIN
}

export interface CertificateTemplate {
  institution: string;
  signerName: string | null;
  signerTitle: string | null;
  legalText: string | null;
}

export interface RenderedDocument {
  bytes: Buffer;
  sha256: string; // Huella hex del archivo exacto → se ancla en Sepolia
  contentType: string;
  extension: string;
}

export interface CertificateRendererPort {
  render(doc: CertificateDocument): Promise<RenderedDocument>;
}
