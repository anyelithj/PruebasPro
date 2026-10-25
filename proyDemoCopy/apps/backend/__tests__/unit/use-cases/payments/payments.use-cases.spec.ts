import { CreateOrderUseCase } from '../../../../src/modules/payments/application/use-cases/create-order.use-case';
import { FulfillOrderUseCase } from '../../../../src/modules/payments/application/use-cases/fulfill-order.use-case';
import { HandleGatewayWebhookUseCase } from '../../../../src/modules/payments/application/use-cases/handle-gateway-webhook.use-case';
import { RefundPaymentUseCase } from '../../../../src/modules/payments/application/use-cases/refund-payment.use-case';
import type { PaymentGatewayPort } from '../../../../src/modules/payments/domain/interfaces/payment-gateway.interface';
import { Money } from '../../../../src/modules/payments/domain/value-objects/money.vo';
// [Suite Payments · Sprint 7.3]: total calculado en el servidor, webhook idempotente (una sola entrega desbloquea) y reembolso total que revoca el acceso | [Patrón]: Test Double (pasarela y repositorios falsos, sin red)

// [Repositorio en memoria]: lo mínimo de TypeORM que usan los casos de uso (`update` con candado por estado)
function memRepo<T extends { id: string }>(rows: T[]) {
  const match = (r: T, where: Partial<T>) =>
    Object.entries(where).every(([k, v]) => r[k as keyof T] === v);
  return {
    rows,
    findOneBy: jest.fn(
      async (where: Partial<T>) => rows.find((r) => match(r, where)) ?? null,
    ),
    update: jest.fn(async (where: Partial<T>, patch: Partial<T>) => {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, patch));
      return { affected: hit.length };
    }),
    save: jest.fn(async (row: T) => {
      const i = rows.findIndex((r) => r.id === row.id);
      if (i >= 0) rows[i] = row;
      else rows.push(row);
      return row;
    }),
    create: jest.fn(
      (x: Partial<T>) => ({ id: `id-${rows.length + 1}`, ...x }) as T,
    ),
  };
}

const gateway = (over: Partial<PaymentGatewayPort> = {}) =>
  ({
    provider: 'stripe',
    enabled: true,
    parseWebhook: jest.fn(() => ({
      kind: 'session-paid',
      eventId: 'evt_1',
      sessionId: 'cs_1',
    })),
    getSessionStatus: jest.fn(async () => ({
      status: 'complete',
      paid: true,
      paymentIntentId: 'pi_1',
    })),
    refund: jest.fn(async () => ({ refundId: 're_1', status: 'succeeded' })),
    ...over,
  }) as unknown as PaymentGatewayPort;

describe('Money', () => {
  it('convierte el precio del catálogo a centavos sin errores de coma flotante', () => {
    expect(Money.fromMajor(19.99, 'usd').amountMinor).toBe(1999);
    expect(() =>
      Money.fromMajor(1, 'USD').add(Money.fromMajor(1, 'EUR')),
    ).toThrow(/monedas/);
  });
});

describe('CreateOrderUseCase', () => {
  it('calcula el total en el servidor y rechaza cursos gratuitos', async () => {
    const orders = memRepo<never>([]);
    const catalog: Record<string, object> = {
      a: {
        id: 'a',
        title: 'Inglés A1',
        price: '10.50',
        currency: 'USD',
        isPublished: true,
      },
      b: {
        id: 'b',
        title: 'Francés A1',
        price: '4.50',
        currency: 'USD',
        isPublished: true,
      },
      free: {
        id: 'free',
        title: 'Gratis',
        price: '0',
        currency: 'USD',
        isPublished: true,
      },
    };
    const courses = {
      findById: jest.fn(async (id: string) => catalog[id] ?? null),
      getEnrollment: jest.fn(async () => null),
    };
    const uc = new CreateOrderUseCase(orders as never, courses as never);
    const order = await uc.execute('u1', ['a', 'b']);
    expect(order).toMatchObject({
      totalMinor: 1500,
      currency: 'USD',
      status: 'pending',
    });
    await expect(uc.execute('u1', ['free'])).rejects.toThrow(/gratuito/);
  });
});

describe('HandleGatewayWebhookUseCase', () => {
  it('un webhook repetido desbloquea los cursos UNA sola vez', async () => {
    const payments = memRepo([
      {
        id: 'p1',
        orderId: 'o1',
        sessionId: 'cs_1',
        status: 'pending',
        paymentIntentId: null,
      },
    ]);
    const orders = memRepo([
      {
        id: 'o1',
        userId: 'u1',
        status: 'pending',
        paidAt: null,
        items: [{ courseId: 'a', title: 'Inglés A1', amountMinor: 1050 }],
      },
    ]);
    const courses = {
      getEnrollment: jest.fn(async () => null),
      upsertEnrollment: jest.fn(async () => ({})),
    };
    const notify = { execute: jest.fn(async () => ({})) };
    const uc = new HandleGatewayWebhookUseCase(
      payments as never,
      orders as never,
      gateway(),
      new FulfillOrderUseCase(
        orders as never,
        courses as never,
        notify as never,
      ),
    );
    await uc.execute(Buffer.from('{}'), 'sig');
    await uc.execute(Buffer.from('{}'), 'sig'); // Reintento de Stripe
    expect(payments.rows[0]).toMatchObject({
      status: 'succeeded',
      paymentIntentId: 'pi_1',
    });
    expect(orders.rows[0]?.status).toBe('paid');
    expect(courses.upsertEnrollment).toHaveBeenCalledTimes(1);
    expect(notify.execute).toHaveBeenCalledTimes(1);
  });

  it('no desbloquea si la sesión se completó sin cobro (pago asíncrono)', async () => {
    const payments = memRepo([
      {
        id: 'p1',
        orderId: 'o1',
        sessionId: 'cs_1',
        status: 'pending',
        paymentIntentId: null,
      },
    ]);
    const gw = gateway({
      getSessionStatus: jest.fn(async () => ({
        status: 'complete' as const,
        paid: false,
        paymentIntentId: 'pi_1',
      })),
    });
    const uc = new HandleGatewayWebhookUseCase(
      payments as never,
      memRepo([]) as never,
      gw,
      {} as never,
    );
    await uc.execute(Buffer.from('{}'), 'sig');
    expect(payments.rows[0]?.status).toBe('pending');
  });
});

describe('RefundPaymentUseCase', () => {
  it('reembolso total: pago reembolsado, orden reembolsada y acceso revocado', async () => {
    const payments = memRepo([
      {
        id: 'p1',
        orderId: 'o1',
        status: 'succeeded',
        paymentIntentId: 'pi_1',
        amountMinor: 1050,
        refundedMinor: 0,
        currency: 'USD',
      },
    ]);
    const refunds = memRepo<never>([]);
    const orders = memRepo([
      {
        id: 'o1',
        userId: 'u1',
        status: 'paid',
        items: [{ courseId: 'a', title: 'Inglés A1', amountMinor: 1050 }],
      },
    ]);
    const courses = { upsertEnrollment: jest.fn(async () => ({})) };
    const gw = gateway();
    const uc = new RefundPaymentUseCase(
      payments as never,
      refunds as never,
      orders as never,
      gw,
      courses as never,
    );
    await uc.execute('admin', 'p1');
    expect(gw.refund).toHaveBeenCalledWith('pi_1', null, 'refund:p1:0:1050'); // null = total · clave idempotente
    expect(payments.rows[0]).toMatchObject({
      status: 'refunded',
      refundedMinor: 1050,
    });
    expect(orders.rows[0]?.status).toBe('refunded');
    expect(courses.upsertEnrollment).toHaveBeenCalledWith('u1', 'a', {
      purchasedAt: null,
    });
    await expect(uc.execute('admin', 'p1')).rejects.toThrow(/confirmado/); // Ya no queda nada por reembolsar
  });
});
