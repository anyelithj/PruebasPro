import { signal } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { FakeEventSource } from '@testing/fake-event-source';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { ViemClient } from '@core/web3/viem-client';
import { WalletRepository } from '@features/web3/domain/wallet.repository.port';
import { WalletHttpRepository } from '@features/web3/infrastructure/wallet.http-repository';
import { CryptoPaymentFacade } from '@features/web3/application/crypto-payment.facade';
import { WalletFacade } from '@features/web3/application/wallet.facade';
import CryptoPaymentPage from '@features/web3/presentation/pages/crypto-payment.page';
// [Spec CryptoPaymentPage]: monto en ETH, envío con la billetera vinculada, confirmaciones en vivo hasta «Pagado» y 409 sin billetera | [Herramienta]: render() con msw + ViemClient falso + FakeEventSource

const ADDR = '0x1111111111111111111111111111111111111111';
const TX = `0x${'a'.repeat(64)}`;
const payment = { id: 'cp1', orderId: 'o1', walletAddress: ADDR, toAddress: `0x${'2'.repeat(40)}`, chainId: 11155111, amountWei: '1999000000000000', status: 'pending', txHash: null, confirmations: 0, error: null, expiresAt: '2030-01-01T00:00:00Z' };
const sendTransaction = jest.fn(async () => TX);
const providers = [
  { provide: WalletRepository, useClass: WalletHttpRepository },
  WalletFacade,
  CryptoPaymentFacade,
  { provide: ViemClient, useValue: { wallets: signal([]), account: signal(ADDR), discover: jest.fn(), sendTransaction } },
];

describe('CryptoPaymentPage', () => {
  it('envía el monto exacto en wei y sigue las confirmaciones hasta «Pagado»', async () => {
    server.use(
      http.get(`${API}/web3/payments/cp1`, () => HttpResponse.json(envelope(payment))),
      http.patch(`${API}/web3/payments/cp1/tx`, () => HttpResponse.json(envelope({ ...payment, status: 'confirming', txHash: TX }))),
    );
    const { fixture, el } = await render(CryptoPaymentPage, providers);
    fixture.componentRef.setInput('id', 'cp1');
    await settle(fixture);
    expect(el.textContent).toContain('0.001999 ETH');
    getByRole(el, 'button', 'Enviar 0.001999 ETH').click();
    await settle(fixture);
    expect(sendTransaction).toHaveBeenCalledWith(payment.toAddress, 1999000000000000n);
    expect(el.textContent).toContain('Confirmando');
    FakeEventSource.last('/events').emit('crypto-payment', { id: 'cp1', status: 'paid', confirmations: 2, error: null });
    await settle(fixture);
    expect(el.textContent).toContain('Pagado');
    expect(getByRole(el, 'link', 'Ir a mis cursos')).toBeTruthy();
  });

  it('sin billetera vinculada (409) ofrece ir a /wallet', async () => {
    server.use(http.post(`${API}/web3/payments`, () => HttpResponse.json({ message: 'Vincula una billetera en /wallet antes de pagar con criptomonedas' }, { status: 409 })));
    const { fixture, el } = await render(CryptoPaymentPage, providers);
    fixture.componentRef.setInput('orden', 'o1');
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('Vincula una billetera');
    expect(getByRole(el, 'link', 'Ir a mi billetera').getAttribute('href')).toBe('/wallet');
  });
});
