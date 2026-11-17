import * as qr from '../../../src/modules/certificates/infrastructure/pdf/certificate-qr';
import { CertificatePdfRenderer } from '../../../src/modules/certificates/infrastructure/pdf/certificate-pdf.renderer';
import {
  newCertificateCode,
  qrTarget,
  verifyUrlFor,
  VERIFY_PATH,
} from '../../../src/modules/certificates/application/use-cases/issue-certificate.use-case';
// [Caso E · 2026-11-13]: el QR del certificado apunta a la página PÚBLICA de verificación https://<DOMINIO>/certificados/verificar/<código>
// (no al PDF ni al explorador), con código aleatorio sin datos personales y URL estable tras emitir | [Patrón]: Spy sobre el generador del QR

describe('URL de verificación del certificado', () => {
  const saved = { ...process.env };
  afterEach(() => (process.env = { ...saved }));

  it('usa el dominio del entorno y la ruta única /certificados/verificar', () => {
    process.env.CERTIFICATE_PUBLIC_URL = 'https://aula.example.org/';
    expect(verifyUrlFor('AULA-ABCD-2345')).toBe(
      'https://aula.example.org/certificados/verificar/AULA-ABCD-2345',
    );
    delete process.env.CERTIFICATE_PUBLIC_URL;
    process.env.FRONTEND_URL = 'https://portal.example.org';
    expect(verifyUrlFor('AULA-ABCD-2345')).toBe(
      `https://portal.example.org${VERIFY_PATH}/AULA-ABCD-2345`,
    ); // Respaldo: FRONTEND_URL
  });

  it('código aleatorio, no consecutivo y sin datos personales', () => {
    const codes = Array.from({ length: 500 }, newCertificateCode);
    expect(
      codes.every((c) => /^AULA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(c)),
    ).toBe(true); // Solo el alfabeto sin 0/O/1/I
    expect(new Set(codes).size).toBe(codes.length); // Sin repeticiones en 500 emisiones
    const sorted = [...codes].sort();
    expect(sorted).not.toEqual(codes); // No sigue un orden (no es un contador)
  });

  it('la URL del QR no cambia tras emitir aunque cambie el dominio configurado', () => {
    process.env.CERTIFICATE_PUBLIC_URL = 'https://otro-dominio.example';
    expect(
      qrTarget({
        code: 'AULA-ABCD-2345',
        verifyUrl:
          'https://aula.example.org/certificados/verificar/AULA-ABCD-2345',
      }),
    ).toBe('https://aula.example.org/certificados/verificar/AULA-ABCD-2345');
    expect(qrTarget({ code: 'AULA-ABCD-2345', verifyUrl: null })).toBe(
      'https://otro-dominio.example/certificados/verificar/AULA-ABCD-2345',
    ); // Anteriores: calculada
  });

  it('el QR del PDF codifica exactamente la URL de verificación (no el PDF ni el explorador)', async () => {
    const spy = jest.spyOn(qr, 'certificateQrSvg');
    const url =
      'https://aula.example.org/certificados/verificar/AULA-ABCD-2345';
    const pdf = await new CertificatePdfRenderer().render({
      code: 'AULA-ABCD-2345',
      recipientName: 'Laura',
      courseTitle: 'Inglés A1',
      cefrLevel: 'A1',
      issuedAt: new Date('2026-11-13'),
      verifyUrl: url,
      kind: 'course',
      examScore: 90,
      template: {
        institution: 'Aula de Idiomas',
        signerName: null,
        signerTitle: null,
        legalText: null,
      },
    } as never); // fmt: skip
    expect(spy).toHaveBeenCalledWith(url, 'A1');
    expect(pdf.bytes.subarray(0, 4).toString()).toBe('%PDF'); // PDF real
    spy.mockRestore();
  });
});
