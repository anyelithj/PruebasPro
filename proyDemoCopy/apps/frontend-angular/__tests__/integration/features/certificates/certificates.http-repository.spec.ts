import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { CertificatesHttpRepository } from '@features/certificates/infrastructure/certificates.http-repository';
// [Spec CertificatesHttpRepository]: cuerpo de emisión (solo courseId), rutas de verificación por código y por hash, envelope de NestJS y 404 → ApiError | [Herramienta]: msw 2

const pub = { valid: true, status: 'issued', code: 'AULA-7KQ2-M9XD', recipientName: 'Ana', courseTitle: 'Inglés A1', issuedAt: '2026-10-16T00:00:00Z', pdfSha256: 'a'.repeat(64), anchor: null, revokeReason: null };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), CertificatesHttpRepository] });
  return TestBed.inject(CertificatesHttpRepository);
}

describe('CertificatesHttpRepository', () => {
  it('POST /certificates envía solo el courseId', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/certificates`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(envelope({ ...pub, id: 'c1', courseId: 'k1', anchorTxHash: null, userId: 'u1', objectKey: 'x' }), { status: 201 });
      }),
    );
    const cert = await firstValueFrom(setup().issue('k1'));
    expect(bodies).toEqual([{ courseId: 'k1' }]);
    expect(cert).not.toHaveProperty('objectKey'); // Zod descarta lo que la UI no usa
  });

  it('verifica por código y por hash con la ruta de NestJS correcta', async () => {
    const tx = `0x${'b'.repeat(64)}`;
    server.use(
      http.get(`${API}/certificates/verify/AULA-7KQ2-M9XD`, () => HttpResponse.json(envelope(pub))),
      http.get(`${API}/certificates/verify/tx/${tx}`, () => HttpResponse.json(envelope({ ...pub, anchor: { txHash: tx, onchainValid: true, confirmations: 3 } }))),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.verify({ kind: 'code', value: 'AULA-7KQ2-M9XD' }))).valid).toBe(true);
    expect((await firstValueFrom(repo.verify({ kind: 'tx', value: tx }))).anchor?.confirmations).toBe(3);
  });

  it('404 llega como ApiError con el mensaje del backend', async () => {
    server.use(http.get(`${API}/certificates/verify/AULA-AAAA-BBBB`, () => HttpResponse.json({ message: 'No existe un certificado con ese código' }, { status: 404 })));
    await expect(firstValueFrom(setup().verify({ kind: 'code', value: 'AULA-AAAA-BBBB' }))).rejects.toEqual(new ApiError(404, 'No existe un certificado con ese código'));
  });

  it('pdfUrl apunta al BFF con el id codificado', () => {
    expect(setup().pdfUrl('c 1')).toBe(`${API}/certificates/c%201/pdf`);
  });
});
