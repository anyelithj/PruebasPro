import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { OrderFacade } from '@features/payments/application/order.facade';
import { PaymentsRepository } from '@features/payments/domain/payments.repository.port';
import type { Order } from '@features/payments/domain/models/payments';
// [Spec OrderFacade]: orden → sesión de pago, modo demostración con 503 (cancela la orden) y error de la orden | [Patrón]: Test Double (repositorio falso)

const order = (status: Order['status'] = 'pending'): Order => ({
  id: 'o1',
  status,
  items: [{ courseId: 'c1', title: 'Inglés A1', amountMinor: 1999 }],
  totalMinor: 1999,
  currency: 'USD',
  createdAt: '2026-10-16T00:00:00Z',
  paidAt: null,
});

function setup(overrides: Partial<PaymentsRepository> = {}) {
  const repo = {
    createOrder: jest.fn(() => of(order())),
    createCheckoutSession: jest.fn(() => of({ paymentId: 'p1', clientSecret: 'cs_secret', publishableKey: 'pk_test_1' })),
    cancelOrder: jest.fn(() => of(order('cancelled'))),
    order: jest.fn(() => of(order('paid'))),
    ...overrides,
  } as unknown as PaymentsRepository;
  TestBed.configureTestingModule({ providers: [OrderFacade, { provide: PaymentsRepository, useValue: repo }] });
  return { facade: TestBed.inject(OrderFacade), repo };
}

describe('OrderFacade', () => {
  it('crea la orden con los ids del carrito y abre la sesión de pago', async () => {
    const { facade, repo } = setup();
    await facade.start(['c1']);
    expect(repo.createOrder).toHaveBeenCalledWith(['c1']);
    expect(facade.session()).toMatchObject({ paymentId: 'p1', clientSecret: 'cs_secret' });
    expect(facade.demoMode()).toBe(false);
  });

  it('503 (Stripe sin configurar) → modo demostración y la orden se cancela', async () => {
    const { facade, repo } = setup({ createCheckoutSession: () => throwError(() => new ApiError(503, 'Pagos no configurados')) });
    await facade.start(['c1']);
    expect(facade.demoMode()).toBe(true);
    expect(repo.cancelOrder).toHaveBeenCalledWith('o1');
    expect(facade.order.data()?.status).toBe('cancelled');
  });

  it('error al crear la orden (curso ya comprado) queda en el estado de la orden', async () => {
    const { facade } = setup({ createOrder: () => throwError(() => new ApiError(409, 'Ya tienes acceso a «Inglés A1»')) });
    await facade.start(['c1']);
    expect(facade.order.error()).toContain('Ya tienes acceso');
    expect(facade.session()).toBeNull();
  });
});
