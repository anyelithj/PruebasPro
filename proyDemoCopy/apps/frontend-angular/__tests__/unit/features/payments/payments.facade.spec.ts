import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { PaymentsFacade } from '@features/payments/application/payments.facade';
import { PaymentsRepository } from '@features/payments/domain/payments.repository.port';
import { refundable, type Payment } from '@features/payments/domain/models/payments';
// [Spec PaymentsFacade]: historial, reembolso que relee el pago y error del backend + regla pura `refundable` | [Patrón]: Test Double (repositorio falso)

const pay = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  orderId: 'o1',
  status: 'succeeded',
  amountMinor: 2000,
  refundedMinor: 0,
  currency: 'USD',
  createdAt: '2026-10-16T00:00:00Z',
  ...over,
});

function setup(overrides: Partial<PaymentsRepository> = {}) {
  const repo = {
    myPayments: jest.fn(() => of([pay()])),
    refund: jest.fn(() => of({ id: 'r1', paymentId: 'p1', amountMinor: 500, currency: 'USD', status: 'succeeded', reason: null, createdAt: '' })),
    paymentStatus: jest.fn(() => of(pay({ status: 'partially_refunded', refundedMinor: 500 }))),
    ...overrides,
  } as unknown as PaymentsRepository;
  TestBed.configureTestingModule({ providers: [PaymentsFacade, { provide: PaymentsRepository, useValue: repo }] });
  return { facade: TestBed.inject(PaymentsFacade), repo };
}

describe('PaymentsFacade', () => {
  it('reembolso parcial: reemplaza la fila con el estado real del backend', async () => {
    const { facade, repo } = setup();
    await facade.load();
    await facade.refund('p1', 500, 'Duplicado');
    expect(repo.refund).toHaveBeenCalledWith('p1', 500, 'Duplicado');
    expect(facade.payments.data()?.[0]).toMatchObject({ status: 'partially_refunded', refundedMinor: 500 });
    expect(facade.refunding()).toBe(false);
  });

  it('error del backend se muestra y la lista no cambia', async () => {
    const { facade } = setup({ refund: () => throwError(() => new ApiError(409, 'Solo se reembolsa un pago confirmado')) });
    await facade.load();
    expect(await facade.refund('p1')).toBeNull();
    expect(facade.actionError()).toContain('confirmado');
    expect(facade.payments.data()?.[0]?.status).toBe('succeeded');
  });

  it('refundable: solo lo que queda de un pago confirmado', () => {
    expect(refundable(pay({ refundedMinor: 500 }))).toBe(1500);
    expect(refundable(pay({ status: 'pending' }))).toBe(0);
    expect(refundable(pay({ status: 'refunded', refundedMinor: 2000 }))).toBe(0);
  });
});
