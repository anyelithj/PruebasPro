import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { CertificatesRepository } from '@features/certificates/domain/certificates.repository.port';
import { CertificatesHttpRepository } from '@features/certificates/infrastructure/certificates.http-repository';
import { CertificatesFacade } from '@features/certificates/application/certificates.facade';
import CertificateVerifyPage from '@features/certificates/presentation/pages/certificate-verify.page';
// [Spec CertificateVerifyPage]: llegada por el QR (/verificar/:code) verifica sola, revocado se anuncia, formato inválido y 404 en role="alert" | [Herramienta]: render() + setInput (parámetro de ruta)

const providers = [{ provide: CertificatesRepository, useClass: CertificatesHttpRepository }, CertificatesFacade];
const TX = `0x${'c'.repeat(64)}`;
const pub = { valid: true, status: 'issued', code: 'AULA-7KQ2-M9XD', recipientName: 'Ana Pérez', courseTitle: 'Inglés A1', issuedAt: '2026-10-16T00:00:00Z', pdfSha256: 'a'.repeat(64), anchor: { txHash: TX, onchainValid: true, confirmations: 12 }, revokeReason: null };

async function open(code?: string) {
  const r = await render(CertificateVerifyPage, providers);
  if (code) {
    r.fixture.componentRef.setInput('code', code);
    await settle(r.fixture);
  }
  return r;
}

describe('CertificateVerifyPage', () => {
  it('desde el QR: verifica sin pulsar y muestra veredicto, cadena y Etherscan', async () => {
    server.use(http.get(`${API}/certificates/verify/AULA-7KQ2-M9XD`, () => HttpResponse.json(envelope(pub))));
    const { el } = await open('AULA-7KQ2-M9XD');
    const status = getByRole(el, 'status');
    expect(status.textContent).toContain('Certificado válido');
    expect(status.textContent).toContain('coincide con la registrada en Sepolia');
    expect(status.querySelector(`a[href$="/tx/${TX}"]`)).not.toBeNull();
  });

  it('revocado: «no válido» con el motivo', async () => {
    server.use(http.get(`${API}/certificates/verify/AULA-7KQ2-M9XD`, () => HttpResponse.json(envelope({ ...pub, valid: false, status: 'revoked', revokeReason: 'Reembolso' }))));
    const { el } = await open('AULA-7KQ2-M9XD');
    expect(el.textContent).toContain('Certificado no válido');
    expect(el.textContent).toContain('Revocado: Reembolso');
  });

  it('formato inválido: alerta sin llamar al backend', async () => {
    const { el, fixture } = await open();
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = 'hola';
    input.dispatchEvent(new Event('input'));
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('Formato no válido');
  });

  it('404 del backend en role="alert"', async () => {
    server.use(http.get(`${API}/certificates/verify/AULA-AAAA-BBBB`, () => HttpResponse.json({ message: 'No existe un certificado con ese código' }, { status: 404 })));
    const { el } = await open('AULA-AAAA-BBBB');
    expect(getByRole(el, 'alert').textContent).toContain('No existe');
  });
});
