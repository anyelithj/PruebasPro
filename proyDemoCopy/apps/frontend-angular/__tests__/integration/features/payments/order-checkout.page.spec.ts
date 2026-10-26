import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { expectAllNamed, getByRole } from '@testing/a11y';
import { PaymentsRepository } from '@features/payments/domain/payments.repository.port';
import { PaymentsHttpRepository } from '@features/payments/infrastructure/payments.http-repository';
import { OrderFacade } from '@features/payments/application/order.facade';
import OrderCheckoutPage from '@features/payments/presentation/pages/order-checkout.page';
// [Spec OrderCheckoutPage]: carrito vacío, modo demostración (503), formulario de Stripe montado y confirmación por sondeo | [Herramienta]: render() con HTTP real contra msw + Stripe.js simulado (sin red)

// [Stripe.js falso]: `createEmbeddedCheckoutPage` devuelve un checkout que registra el montaje
const mount = jest.fn();
jest.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: jest.fn(async () => ({ createEmbeddedCheckoutPage: jest.fn(async () => ({ mount, destroy: jest.fn() })) })),
}));

const PROVIDERS = [{ provide: PaymentsRepository, useClass: PaymentsHttpRepository }, OrderFacade];
const order = { id: 'o1', status: 'pending', items: [{ courseId: 'c1', title: 'Inglés A1', amountMinor: 1999 }], totalMinor: 1999, currency: 'USD', createdAt: '2026-10-16T00:00:00Z', paidAt: null };
const cartItem = { id: 'c1', title: 'Inglés A1', price: 19.99, currency: 'USD', color: '#6366f1', href: '/courses/ingles-a1' };

describe('OrderCheckoutPage', () => {
  afterEach(() => localStorage.clear());

  it('carrito vacío: invita a ver cursos', async () => {
    const { el } = await render(OrderCheckoutPage, PROVIDERS);
    expect(el.textContent).toContain('Tu carrito está vacío');
    expect(getByRole(el, 'link', 'Ver cursos').getAttribute('href')).toBe('/courses');
  });

  it('pagar: crea la orden y monta el formulario embebido de Stripe', async () => {
    localStorage.setItem('cart', JSON.stringify([cartItem]));
    server.use(
      http.post(`${API}/payments/orders`, () => HttpResponse.json(envelope(order), { status: 201 })),
      http.post(`${API}/payments/checkout-session`, () => HttpResponse.json(envelope({ paymentId: 'p1', clientSecret: 'cs_secret', publishableKey: 'pk_test_1' }), { status: 201 })),
    );
    const { fixture, el } = await render(OrderCheckoutPage, PROVIDERS);
    expect(el.textContent).toContain('Inglés A1');
    getByRole(el, 'button', 'Pagar con tarjeta').click();
    await settle(fixture);
    expect(getByRole(el, 'region', 'Formulario de pago seguro de Stripe')).toBeTruthy();
    expect(mount).toHaveBeenCalled();
    expectAllNamed(el);
  });

  it('servidor sin Stripe (503): ofrece la compra de demostración', async () => {
    localStorage.setItem('cart', JSON.stringify([cartItem]));
    server.use(
      http.post(`${API}/payments/orders`, () => HttpResponse.json(envelope(order), { status: 201 })),
      http.post(`${API}/payments/checkout-session`, () => HttpResponse.json({ message: 'Pagos no configurados' }, { status: 503 })),
      http.patch(`${API}/payments/orders/o1/cancel`, () => HttpResponse.json(envelope({ ...order, status: 'cancelled' }))),
    );
    const { fixture, el } = await render(OrderCheckoutPage, PROVIDERS);
    getByRole(el, 'button', 'Pagar con tarjeta').click();
    await settle(fixture);
    expect(el.textContent).toContain('Pagos con tarjeta no configurados');
    expect(getByRole(el, 'button', 'Completar compra de demostración')).toBeTruthy();
  });

  it('confirmación: muestra «Pagado» y quita los cursos del carrito', async () => {
    localStorage.setItem('cart', JSON.stringify([cartItem]));
    server.use(
      http.get(`${API}/payments/p1/status`, () => HttpResponse.json(envelope({ id: 'p1', orderId: 'o1', status: 'succeeded', amountMinor: 1999, refundedMinor: 0, currency: 'USD', createdAt: '2026-10-16T00:00:00Z' }))),
      http.get(`${API}/payments/orders/o1`, () => HttpResponse.json(envelope({ ...order, status: 'paid', paidAt: '2026-10-16T00:01:00Z' }))),
    );
    const { fixture, el } = await render(OrderCheckoutPage, PROVIDERS);
    fixture.componentRef.setInput('orderId', 'o1');
    fixture.componentRef.setInput('pago', 'p1');
    await settle(fixture);
    await settle(fixture);
    expect(el.textContent).toContain('Pagado');
    expect(getByRole(el, 'link', 'Ir a mis cursos')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('cart') ?? '[]')).toEqual([]);
  });
});
