import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { web3Config } from '../../../../src/shared/config/web3.config';
import { CreateSiweNonceUseCase } from '../../../../src/modules/web3/application/use-cases/create-siwe-nonce.use-case';
import { LinkWalletUseCase } from '../../../../src/modules/web3/application/use-cases/link-wallet.use-case';
import { ConfirmOnchainPaymentUseCase } from '../../../../src/modules/web3/application/use-cases/confirm-onchain-payment.use-case';
import { VerifyCertificateHashUseCase } from '../../../../src/modules/web3/application/use-cases/verify-certificate-hash.use-case';
import { FakeBlockchainAdapter } from '../../../../src/modules/web3/infrastructure/chain/fake-blockchain.adapter';
// [Suite Web3 · Sprints 7.5/7.6]: firma SIWE real (viem, sin red), verificación on-chain contra la cadena falsa (remitente, monto, confirmaciones) y anclaje del hash | [Patrón]: Test Double (FakeBlockchainAdapter + caché y repositorios en memoria)

const mem = () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (k: string) => store.get(k)),
    set: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
    del: jest.fn(async (k: string) => void store.delete(k)),
  };
};

function repo<T extends { id: string }>(rows: T[]) {
  const match = (r: T, w: Partial<T>) =>
    Object.entries(w).every(([k, v]) => r[k as keyof T] === v);
  return {
    rows,
    findOneBy: jest.fn(
      async (w: Partial<T>) => rows.find((r) => match(r, w)) ?? null,
    ),
    update: jest.fn(async (w: Partial<T>, patch: Partial<T>) => {
      const hit = rows.filter((r) => match(r, w));
      hit.forEach((r) => Object.assign(r, patch));
      return { affected: hit.length };
    }),
    save: jest.fn(async (x: T) => (rows.push(x), x)),
    create: jest.fn((x: Partial<T>) => ({ id: 'w1', ...x }) as T),
  };
}

describe('LinkWalletUseCase (SIWE EIP-4361)', () => {
  it('vincula la dirección que firmó el reto y rechaza reutilizar el mismo mensaje', async () => {
    const cache = mem();
    const wallets = repo<{ id: string; userId: string; address: string }>([]);
    const challenge = await new CreateSiweNonceUseCase(cache as never).execute(
      'u1',
    );
    const account = privateKeyToAccount(generatePrivateKey()); // Billetera de prueba en memoria
    const message = createSiweMessage({
      address: account.address,
      chainId: challenge.chainId,
      domain: challenge.domain,
      nonce: challenge.nonce,
      uri: challenge.uri,
      version: '1',
    });
    const signature = await account.signMessage({ message });
    const link = new LinkWalletUseCase(wallets as never, cache as never);
    const wallet = await link.execute('u1', message, signature);
    expect(wallet.address).toBe(account.address);
    await expect(link.execute('u1', message, signature)).rejects.toThrow(
      /caducó/,
    ); // Nonce de un solo uso
  });

  it('rechaza una firma de otra cuenta', async () => {
    const cache = mem();
    const challenge = await new CreateSiweNonceUseCase(cache as never).execute(
      'u1',
    );
    const victim = privateKeyToAccount(generatePrivateKey());
    const attacker = privateKeyToAccount(generatePrivateKey());
    const message = createSiweMessage({
      address: victim.address,
      chainId: challenge.chainId,
      domain: challenge.domain,
      nonce: challenge.nonce,
      uri: challenge.uri,
      version: '1',
    });
    const signature = await attacker.signMessage({ message });
    await expect(
      new LinkWalletUseCase(repo([]) as never, cache as never).execute(
        'u1',
        message,
        signature,
      ),
    ).rejects.toThrow(/firma/);
  });
});

describe('ConfirmOnchainPaymentUseCase', () => {
  const user = privateKeyToAccount(generatePrivateKey());
  const setup = (
    tx: { from?: string; value?: bigint },
    confirmations: number,
  ) => {
    const chain = new FakeBlockchainAdapter();
    const hash = `0x${'a'.repeat(64)}`;
    chain.seed({
      hash,
      from: tx.from ?? user.address,
      to: chain.platformAddress,
      value: tx.value ?? 1000n,
    });
    chain.confirm(hash, confirmations);
    const payments = repo([
      {
        id: 'cp1',
        orderId: 'o1',
        userId: 'u1',
        walletAddress: user.address,
        toAddress: chain.platformAddress,
        chainId: chain.chainId,
        amountWei: '1000',
        status: 'confirming',
        txHash: hash,
        confirmations: 0,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    const fulfill = { execute: jest.fn(async () => true) };
    const broadcast = { execute: jest.fn() };
    return {
      uc: new ConfirmOnchainPaymentUseCase(
        payments as never,
        chain,
        fulfill as never,
        broadcast as never,
      ),
      payments,
      fulfill,
      broadcast,
    };
  };

  it('con las confirmaciones mínimas: PAGADO y la orden se completa una sola vez', async () => {
    const { uc, payments, fulfill } = setup({}, web3Config().minConfirmations);
    expect(await uc.execute('cp1')).toBe('paid');
    expect(await uc.execute('cp1')).toBe('paid'); // Segunda vuelta del worker: ya no está CONFIRMANDO
    expect(payments.rows[0]?.status).toBe('paid');
    expect(fulfill.execute).toHaveBeenCalledTimes(1);
  });

  it('sin confirmaciones suficientes sigue CONFIRMANDO y emite el progreso', async () => {
    const { uc, broadcast } = setup({}, 1);
    expect(await uc.execute('cp1')).toBe('confirming');
    expect(broadcast.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'crypto-payment' }),
    );
  });

  it('remitente distinto o monto insuficiente: FALLIDO', async () => {
    const other = privateKeyToAccount(generatePrivateKey());
    expect(await setup({ from: other.address }, 5).uc.execute('cp1')).toBe(
      'failed',
    );
    const low = setup({ value: 999n }, 5);
    expect(await low.uc.execute('cp1')).toBe('failed');
    expect(low.payments.rows[0]?.status).toBe('failed');
    expect(low.fulfill.execute).not.toHaveBeenCalled();
  });
});

describe('VerifyCertificateHashUseCase', () => {
  it('válido solo si la plataforma ancló exactamente ese hash', async () => {
    const chain = new FakeBlockchainAdapter();
    const sha = 'b'.repeat(64);
    const txHash = await chain.sendTransaction({
      to: chain.platformAddress,
      data: `0x${sha}`,
    });
    chain.confirm(txHash, 3);
    const uc = new VerifyCertificateHashUseCase(chain);
    expect(await uc.execute(txHash, sha)).toMatchObject({
      valid: true,
      confirmations: 3,
    });
    expect((await uc.execute(txHash, 'c'.repeat(64))).valid).toBe(false); // PDF alterado
  });
});
