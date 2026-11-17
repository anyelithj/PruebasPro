import { createHmac } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
// [Spec MercadoPagoGatewayAdapter · 2026-11-16]: preferencia en COP, estado por external_reference y firma del webhook (x-signature) · `fetch` simulado (sin red)

process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-1234567890';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto-de-prueba';
process.env.MERCADOPAGO_USD_COP_RATE = '4000';

import { MercadoPagoGatewayAdapter } from '../../../../src/modules/payments/infrastructure/gateways/mercadopago-gateway.adapter';
import { Money } from '../../../../src/modules/payments/domain/value-objects/money.vo';

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;

describe('MercadoPagoGatewayAdapter', () => {
  const mp = new MercadoPagoGatewayAdapter();
  afterEach(() => jest.restoreAllMocks());

  it('crea la preferencia en COP (USD × tasa) y devuelve la URL de pago de pruebas', async () => {
    const f = jest.spyOn(global, 'fetch').mockResolvedValue(
      json({
        id: 'pref-1',
        init_point: 'https://mp/real',
        sandbox_init_point: 'https://mp/sandbox',
      }),
    );
    const r = await mp.createCheckoutSession({
      paymentId: 'pay-1',
      orderId: 'ord-1',
      idempotencyKey: 'checkout:ord-1:1',
      returnUrl: 'http://localhost:9000/checkout/confirmacion/ord-1?pago=pay-1',
      lines: [{ name: 'Inglés A1', amount: Money.fromMajor(19.99, 'USD') }],
    });
    expect(r).toEqual({
      sessionId: 'pay-1',
      clientSecret: '',
      redirectUrl: 'https://mp/sandbox',
    });
    const body = JSON.parse(f.mock.calls[0][1]!.body as string) as {
      items: unknown[];
      external_reference: string;
      auto_return?: string;
    };
    expect(body.items[0]).toMatchObject({
      currency_id: 'COP',
      unit_price: 79960,
    });
    expect(body.external_reference).toBe('pay-1');
    expect(body.auto_return).toBeUndefined(); // http://localhost → Mercado Pago rechaza auto_return
  });

  it('pago aprobado con nuestra external_reference = pagado', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      json({
        results: [{ id: 9, status: 'approved', external_reference: 'pay-1' }],
      }),
    );
    await expect(mp.getSessionStatus('pay-1')).resolves.toEqual({
      status: 'complete',
      paid: true,
      paymentIntentId: '9',
    });
  });

  it('webhook: firma válida → consulta el pago y lo concilia; firma falsa → 400', async () => {
    const ts = '1700000000';
    const v1 = createHmac('sha256', 'secreto-de-prueba')
      .update(`id:77;request-id:req-1;ts:${ts};`)
      .digest('hex');
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        json({ id: 77, status: 'approved', external_reference: 'pay-1' }),
      );
    const raw = Buffer.from(
      JSON.stringify({ type: 'payment', data: { id: '77' } }),
    );
    await expect(
      mp.parseWebhook(raw, `ts=${ts},v1=${v1}`, {
        requestId: 'req-1',
        dataId: '77',
        topic: 'payment',
      }),
    ).resolves.toMatchObject({
      kind: 'session-paid',
      sessionId: 'pay-1',
    });
    await expect(
      mp.parseWebhook(raw, `ts=${ts},v1=${'0'.repeat(64)}`, {
        requestId: 'req-1',
        dataId: '77',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
