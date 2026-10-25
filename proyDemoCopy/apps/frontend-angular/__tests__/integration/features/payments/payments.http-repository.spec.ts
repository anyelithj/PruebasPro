import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { PaymentsHttpRepository } from '@features/payments/infrastructure/payments.http-repository';
// [Spec PaymentsHttpRepository]: cuerpos (solo ids, nunca precios), envelope de NestJS, PATCH de cancelación, reembolso sin claves vacías y 503 → ApiError | [Herramienta]: msw 2

const order = { id: 'o1', status: 'pending', items: [{ courseId: 'c1', title: 'Inglés A1', amountMinor: 1999 }], totalMinor: 1999, currency: 'USD', createdAt: '2026-10-16T00:00:00Z', paidAt: null };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), PaymentsHttpRepository] });
  return TestBed.inject(PaymentsHttpRepository);
}

describe('PaymentsHttpRepository', () => {
  it('POST /payments/orders envía solo los ids y desenvuelve la orden', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/payments/orders`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(envelope(order), { status: 201 });
      }),
    );
    expect((await firstValueFrom(setup().createOrder(['c1']))).totalMinor).toBe(1999);
    expect(bodies).toEqual([{ courseIds: ['c1'] }]);
  });

  it('cancelar usa PATCH (mismo método que el controlador de NestJS)', async () => {
    let method = '';
    server.use(
      http.patch(`${API}/payments/orders/o1/cancel`, ({ request }) => {
        method = request.method;
        return HttpResponse.json(envelope({ ...order, status: 'cancelled' }));
      }),
    );
    expect((await firstValueFrom(setup().cancelOrder('o1'))).status).toBe('cancelled');
    expect(method).toBe('PATCH');
  });

  it('reembolso sin monto ni motivo no envía claves vacías', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/payments/p1/refund`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(envelope({ id: 'r1', paymentId: 'p1', amountMinor: 1999, currency: 'USD', status: 'succeeded', reason: null, createdAt: '' }), { status: 201 });
      }),
    );
    await firstValueFrom(setup().refund('p1'));
    expect(bodies).toEqual([{}]);
  });

  it('503 (Stripe sin configurar) llega como ApiError', async () => {
    server.use(http.post(`${API}/payments/checkout-session`, () => HttpResponse.json({ message: 'Pagos no configurados' }, { status: 503 })));
    await expect(firstValueFrom(setup().createCheckoutSession('o1'))).rejects.toEqual(new ApiError(503, 'Pagos no configurados'));
  });
});
