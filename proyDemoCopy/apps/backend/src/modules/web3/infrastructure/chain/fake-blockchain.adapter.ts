import { randomBytes } from 'node:crypto';
import type {
  BlockchainGatewayPort,
  ChainTx,
  SendTxInput,
} from '../../domain/interfaces/blockchain-gateway.interface';
// [FakeBlockchainAdapter · Sprint 7.5]: cadena en memoria para pruebas unitarias (sin red, sin claves, determinista) | [Patrón]: Test Double (Fake) que implementa el mismo puerto | [Principio]: DIP + LSP (sustituye al adaptador viem sin cambiar los casos de uso) | [Paradigma]: POO
// [Uso]: `seed(tx)` simula una transacción del usuario y `confirm(hash, n)` avanza bloques

export class FakeBlockchainAdapter implements BlockchainGatewayPort {
  readonly chainId = 11155111; // Sepolia
  readonly enabled = true;
  readonly canSend = true;
  readonly txs = new Map<string, ChainTx>();
  private readonly confirmations = new Map<string, number>();

  constructor(
    readonly platformAddress: string = '0x000000000000000000000000000000000000dEaD',
  ) {}

  seed(tx: Partial<ChainTx> & { hash: string }): ChainTx {
    const full: ChainTx = {
      from: '0x0',
      to: this.platformAddress,
      value: 0n,
      chainId: this.chainId,
      input: '0x',
      blockNumber: 1n,
      status: 'success',
      ...tx,
    };
    this.txs.set(full.hash, full);
    return full;
  }

  confirm(hash: string, n: number): void {
    this.confirmations.set(hash, n);
  }

  sendTransaction(input: SendTxInput): Promise<string> {
    const hash = `0x${randomBytes(32).toString('hex')}`;
    this.seed({
      hash,
      from: this.platformAddress,
      to: input.to,
      value: input.value ?? 0n,
      input: input.data ?? '0x',
    });
    return Promise.resolve(hash);
  }

  getTransaction(hash: string): Promise<ChainTx | null> {
    return Promise.resolve(this.txs.get(hash) ?? null);
  }

  getConfirmations(hash: string): Promise<number> {
    return Promise.resolve(this.confirmations.get(hash) ?? 0);
  }
}
