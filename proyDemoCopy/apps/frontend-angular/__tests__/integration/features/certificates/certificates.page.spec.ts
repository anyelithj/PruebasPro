import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { CertificatesRepository } from '@features/certificates/domain/certificates.repository.port';
import { CertificatesHttpRepository } from '@features/certificates/infrastructure/certificates.http-repository';
import { CertificatesFacade } from '@features/certificates/application/certificates.facade';
import CertificatesPage from '@features/certificates/presentation/pages/certificates.page';
// [Spec CertificatesPage]: vacío, curso listo con botón nombrado, certificado emitido con descarga y anclaje pendiente, error | [Herramienta]: render() con HTTP real contra msw

const providers = [{ provide: CertificatesRepository, useClass: CertificatesHttpRepository }, CertificatesFacade];
const cert = { id: 'c1', courseId: 'k1', code: 'AULA-7KQ2-M9XD', recipientName: 'Ana', courseTitle: 'Inglés A1', pdfSha256: 'a'.repeat(64), anchorTxHash: null, status: 'issued', revokeReason: null, issuedAt: '2026-10-16T00:00:00Z' };
const mine = (body: unknown) => server.use(http.get(`${API}/certificates/me`, () => HttpResponse.json(envelope(body))));

describe('CertificatesPage', () => {
  it('sin cursos terminados muestra el estado vacío', async () => {
    mine({ items: [], eligible: [] });
    const { el } = await render(CertificatesPage, providers);
    expect(el.textContent).toContain('Completa un curso al 100 %');
  });

  it('curso listo: botón «Solicitar certificado» con el nombre del curso', async () => {
    mine({ items: [], eligible: [{ courseId: 'k2', title: 'Francés A2' }] });
    const { el } = await render(CertificatesPage, providers);
    expect(el.querySelector('button[aria-label="Solicitar certificado: Francés A2"]')).not.toBeNull();
  });

  it('emitido: código enlazado a /verificar, «Vigente», anclaje pendiente y descarga del PDF', async () => {
    mine({ items: [cert], eligible: [] });
    const { el } = await render(CertificatesPage, providers);
    expect(el.querySelector('a[href="/verificar/AULA-7KQ2-M9XD"]')).not.toBeNull();
    expect(el.textContent).toContain('Vigente');
    expect(el.textContent).toContain('Pendiente de anclaje');
    expect(el.querySelector(`a[download][href="${API}/certificates/c1/pdf"]`)).not.toBeNull();
    expect(el.querySelector(`img[src="${API}/certificates/verify/AULA-7KQ2-M9XD/qr"]`)?.getAttribute('alt')).toContain('AULA-7KQ2-M9XD'); // QR (qrcode en NestJS)
  });

  it('error al cargar', async () => {
    server.use(http.get(`${API}/certificates/me`, () => HttpResponse.json({ message: 'Servicio no disponible' }, { status: 500 })));
    const { el } = await render(CertificatesPage, providers);
    expect(getByRole(el, 'alert').textContent).toBeTruthy();
  });
});
