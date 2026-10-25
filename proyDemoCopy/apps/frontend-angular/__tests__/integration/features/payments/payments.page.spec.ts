import { signal } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { SessionService } from '@core/auth/session.service';
import { PaymentsRepository } from '@features/payments/domain/payments.repository.port';
import { PaymentsHttpRepository } from '@features/payments/infrastructure/payments.http-repository';
import { PaymentsFacade } from '@features/payments/application/payments.facade';
import PaymentsPage from '@features/payments/presentation/pages/payments.page';
// [Spec PaymentsPage]: vacío, historial con estado en texto, botón de reembolso solo para ADMIN y error | [Herramienta]: render() con HTTP real contra msw + sesión falsa

const row = { id: 'p1', orderId: 'o1', status: 'succeeded', amountMinor: 1999, refundedMinor: 0, currency: 'USD', createdAt: '2026-10-16T00:00:00Z' };
const providers = (role: 'USER' | 'ADMIN') => [
  { provide: PaymentsRepository, useClass: PaymentsHttpRepository },
  PaymentsFacade,
  { provide: SessionService, useValue: { hasRole: (r: string) => r === role, user: signal(null) } },
];

describe('PaymentsPage', () => {
  it('sin pagos muestra el estado vacío', async () => {
    server.use(http.get(`${API}/payments/me`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(PaymentsPage, providers('USER'));
    expect(el.textContent).toContain('Aún no tienes pagos');
  });

  it('estudiante: ve «Pagado» pero no el botón de reembolso', async () => {
    server.use(http.get(`${API}/payments/me`, () => HttpResponse.json(envelope([row]))));
    const { el } = await render(PaymentsPage, providers('USER'));
    expect(el.textContent).toContain('Pagado');
    expect(el.textContent).not.toContain('Reembolsar');
  });

  it('ADMIN: aparece «Reembolsar» en un pago confirmado', async () => {
    server.use(http.get(`${API}/payments/me`, () => HttpResponse.json(envelope([row]))));
    const { el } = await render(PaymentsPage, providers('ADMIN'));
    expect(el.querySelector('table button')?.textContent).toContain('Reembolsar');
  });

  it('error al cargar', async () => {
    server.use(http.get(`${API}/payments/me`, () => HttpResponse.json({ message: 'Servicio no disponible' }, { status: 500 })));
    const { el } = await render(PaymentsPage, providers('USER'));
    expect(getByRole(el, 'alert').textContent).toBeTruthy();
  });
});
