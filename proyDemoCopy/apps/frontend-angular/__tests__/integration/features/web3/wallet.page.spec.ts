import { signal } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { expectAllNamed, getByRole } from '@testing/a11y';
import { ViemClient } from '@core/web3/viem-client';
import { WalletRepository } from '@features/web3/domain/wallet.repository.port';
import { WalletHttpRepository } from '@features/web3/infrastructure/wallet.http-repository';
import { WalletFacade } from '@features/web3/application/wallet.facade';
import WalletPage from '@features/web3/presentation/pages/wallet.page';
// [Spec WalletPage]: sin extensiones (aviso), billetera detectada (botón con nombre), lista vinculada y error | [Herramienta]: render() con HTTP real contra msw + ViemClient falso (sin extensión)

const ADDR = '0x1111111111111111111111111111111111111111';
const providers = (wallets: unknown[] = []) => [
  { provide: WalletRepository, useClass: WalletHttpRepository },
  WalletFacade,
  { provide: ViemClient, useValue: { wallets: signal(wallets), account: signal(null), discover: jest.fn() } },
];

describe('WalletPage', () => {
  it('sin billeteras instaladas lo explica y la lista vinculada está vacía', async () => {
    server.use(http.get(`${API}/web3/wallets/me`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(WalletPage, providers());
    expect(el.textContent).toContain('No se detectó ninguna billetera');
    expect(el.textContent).toContain('Aún no tienes billeteras vinculadas');
  });

  it('muestra un botón por billetera detectada (EIP-6963) y las vinculadas', async () => {
    server.use(http.get(`${API}/web3/wallets/me`, () => HttpResponse.json(envelope([{ id: 'w1', address: ADDR, chainId: 11155111, linkedAt: '2026-10-16T00:00:00Z' }]))));
    const { el } = await render(WalletPage, providers([{ info: { uuid: 'u1', name: 'MetaMask', icon: 'data:,', rdns: 'io.metamask' }, provider: {} }]));
    expect(getByRole(el, 'button', 'Conectar con MetaMask')).toBeTruthy();
    expect(el.textContent).toContain('0x1111…1111');
    expect(getByRole(el, 'button', `Desvincular ${ADDR}`)).toBeTruthy();
    expectAllNamed(el);
  });

  it('error al cargar', async () => {
    server.use(http.get(`${API}/web3/wallets/me`, () => HttpResponse.json({ message: 'Servicio no disponible' }, { status: 503 })));
    const { el } = await render(WalletPage, providers());
    expect(getByRole(el, 'alert').textContent).toContain('Servicio no disponible');
  });
});
