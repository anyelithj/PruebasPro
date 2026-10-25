import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { FakeEventSource } from '@testing/fake-event-source';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { WalletHttpRepository } from '@features/web3/infrastructure/wallet.http-repository';
// [Spec WalletHttpRepository]: cuerpo de verify (mensaje + firma), PATCH del txHash, 409 sin billetera → ApiError y evento SSE `crypto-payment` | [Herramienta]: msw 2 + FakeEventSource

const payment = { id: 'cp1', orderId: 'o1', walletAddress: `0x${'1'.repeat(40)}`, toAddress: `0x${'2'.repeat(40)}`, chainId: 11155111, amountWei: '1999000000000000', status: 'pending', txHash: null, confirmations: 0, error: null, expiresAt: '2026-10-16T01:00:00Z' };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), WalletHttpRepository] });
  return TestBed.inject(WalletHttpRepository);
}

describe('WalletHttpRepository', () => {
  it('POST /web3/wallets/verify envía mensaje y firma', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/web3/wallets/verify`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(envelope({ id: 'w1', address: payment.walletAddress, chainId: 11155111, linkedAt: '2026-10-16T00:00:00Z' }));
      }),
    );
    expect((await firstValueFrom(setup().verify('msg', '0xsig'))).id).toBe('w1');
    expect(bodies).toEqual([{ message: 'msg', signature: '0xsig' }]);
  });

  it('registrar la transacción usa PATCH con el hash', async () => {
    let body: unknown;
    server.use(
      http.patch(`${API}/web3/payments/cp1/tx`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ ...payment, status: 'confirming', txHash: `0x${'a'.repeat(64)}` }));
      }),
    );
    expect((await firstValueFrom(setup().registerTx('cp1', `0x${'a'.repeat(64)}`))).status).toBe('confirming');
    expect(body).toEqual({ txHash: `0x${'a'.repeat(64)}` });
  });

  it('409 (sin billetera vinculada) llega como ApiError', async () => {
    server.use(http.post(`${API}/web3/payments`, () => HttpResponse.json({ message: 'Vincula una billetera en /wallet antes de pagar con criptomonedas' }, { status: 409 })));
    await expect(firstValueFrom(setup().createCryptoPayment('o1'))).rejects.toEqual(new ApiError(409, 'Vincula una billetera en /wallet antes de pagar con criptomonedas'));
  });

  it('progreso en vivo desde /api/events', async () => {
    const next = firstValueFrom(setup().progress().pipe(take(1)));
    FakeEventSource.last('/events').emit('crypto-payment', { id: 'cp1', status: 'confirming', confirmations: 1, error: null });
    expect(await next).toEqual({ id: 'cp1', status: 'confirming', confirmations: 1, error: null });
  });
});
