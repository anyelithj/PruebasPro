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
