import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { parseSiweMessage } from 'viem/siwe';
import { ViemClient, type DiscoveredWallet } from '@core/web3/viem-client';
import { WalletFacade } from '@features/web3/application/wallet.facade';
import { WalletRepository } from '@features/web3/domain/wallet.repository.port';
// [Spec WalletFacade]: conectar → reto → mensaje SIWE (EIP-4361) firmado → vincular; rechazo en la billetera; desvincular | [Patrón]: Test Double (billetera y repositorio falsos, sin extensión ni red)

const ADDR = '0x1111111111111111111111111111111111111111';
const challenge = { nonce: 'abcdef1234567890', domain: 'localhost:9000', uri: 'http://localhost:9000', chainId: 11155111, statement: 'Vincular' };
const fakeWallet = { info: { uuid: 'u1', name: 'MetaMask', icon: 'data:,', rdns: 'io.metamask' }, provider: {} } as unknown as DiscoveredWallet;

function setup(viemOver: Partial<Record<'connect' | 'signMessage', jest.Mock>> = {}, repoOver: Partial<WalletRepository> = {}) {
  const viem = { wallets: signal([fakeWallet]), account: signal(ADDR), discover: jest.fn(), connect: jest.fn(async () => ADDR), signMessage: jest.fn(async () => `0x${'1'.repeat(130)}`), ...viemOver };
  const repo = {
    mine: jest.fn(() => of([])),
    nonce: jest.fn(() => of(challenge)),
    verify: jest.fn(() => of({ id: 'w1', address: ADDR, chainId: 11155111, linkedAt: '2026-10-16T00:00:00Z' })),
    unlink: jest.fn(() => of({})),
    ...repoOver,
  } as unknown as WalletRepository;
  TestBed.configureTestingModule({ providers: [WalletFacade, { provide: WalletRepository, useValue: repo }, { provide: ViemClient, useValue: viem }] });
  return { facade: TestBed.inject(WalletFacade), viem, repo };
}

describe('WalletFacade', () => {
  it('firma un mensaje SIWE con el dominio, la red y el nonce del servidor y vincula la billetera', async () => {
    const { facade, viem, repo } = setup();
    await facade.load();
    const linked = await facade.connectAndLink(fakeWallet);
    const message = viem.signMessage.mock.calls[0][0] as string;
    expect(parseSiweMessage(message)).toMatchObject({ address: ADDR, domain: 'localhost:9000', nonce: challenge.nonce, chainId: 11155111 });
    expect(repo.verify).toHaveBeenCalledWith(message, expect.stringMatching(/^0x/));
    expect(linked?.id).toBe('w1');
    expect(facade.wallets.data()).toHaveLength(1);
  });

  it('si el usuario rechaza la firma, muestra el error y no vincula', async () => {
    const { facade, repo } = setup({ signMessage: jest.fn(async () => Promise.reject(new Error('User rejected the request.'))) });
    expect(await facade.connectAndLink(fakeWallet)).toBeNull();
    expect(facade.actionError()).toContain('rejected');
    expect(repo.verify).not.toHaveBeenCalled();
    expect(facade.linking()).toBe(false);
  });

  it('desvincular quita la fila solo si el backend confirma', async () => {
    const { facade } = setup({}, { mine: () => of([{ id: 'w1', address: ADDR, chainId: 11155111, linkedAt: '' }]), unlink: () => throwError(() => new Error('Billetera no encontrada')) });
    await facade.load();
    await facade.unlink('w1');
    expect(facade.wallets.data()).toHaveLength(1);
    expect(facade.actionError()).toContain('no encontrada');
  });
});
