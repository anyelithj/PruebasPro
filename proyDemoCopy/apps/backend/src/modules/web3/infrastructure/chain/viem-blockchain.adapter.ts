import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
// [Sepolia · 2026-10-19]: definida aquí con `defineChain` → `viem/chains` (todas las redes, ~2,6 s de carga) ya no se importa al arrancar
// Mismos datos que `sepolia` de viem; el RPC real lo da WEB3_RPC_URL
const sepolia = defineChain({
  id: 11_155_111,
  name: 'Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] } },
  blockExplorers: { default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' } },
  testnet: true,
});
import { web3Config } from '../../../../shared/config/web3.config';
import type {
  BlockchainGatewayPort,
  ChainTx,
  SendTxInput,
} from '../../domain/interfaces/blockchain-gateway.interface';
// [ViemBlockchainAdapter · Sprint 7.5]: implementa BlockchainGatewayPort contra Sepolia con viem (cliente público para leer, cliente de billetera con la clave de la plataforma para anclar) | [Patrón]: Adapter (Hexagonal) + Anti-Corruption Layer | [Principio]: DIP + SRP | [Paradigma]: POO + async/await
// [Seguridad]: la clave privada vive solo en el proceso (variable de entorno) y SOLO para Sepolia; nunca sale en respuestas ni logs

@Injectable()
export class ViemBlockchainAdapter implements BlockchainGatewayPort {
  private readonly cfg = web3Config();
  readonly chainId = sepolia.id;
  private readonly account: PrivateKeyAccount | null = this.cfg.privateKey
    ? privateKeyToAccount(this.cfg.privateKey)
    : null;
  // `http(url)` (viem): transporte JSON-RPC | sin RPC → null y el puerto queda desactivado
  private readonly reader: PublicClient | null = this.cfg.rpcUrl
    ? createPublicClient({ chain: sepolia, transport: http(this.cfg.rpcUrl) })
    : null;
  private readonly writer: WalletClient | null =
    this.cfg.rpcUrl && this.account
      ? createWalletClient({
          account: this.account,
          chain: sepolia,
          transport: http(this.cfg.rpcUrl),
        })
      : null;

  get enabled(): boolean {
    return this.reader !== null && this.platformAddress !== null;
  }

  get canSend(): boolean {
    return this.writer !== null;
  }

  // [platformAddress]: la configurada o la de la clave privada (misma cuenta recibe pagos y ancla)
  get platformAddress(): string | null {
    return this.cfg.platformAddress ?? this.account?.address ?? null;
  }

  private client(): PublicClient {
    if (!this.reader)
      throw new ServiceUnavailableException(
        'Web3 no configurado: define WEB3_RPC_URL (Sepolia)',
      );
    return this.reader;
  }

  async sendTransaction(input: SendTxInput): Promise<string> {
    if (!this.writer || !this.account)
      throw new ServiceUnavailableException(
        'Anclaje no configurado: define WEB3_PLATFORM_PRIVATE_KEY',
      );
    return this.writer.sendTransaction({
      account: this.account,
      chain: sepolia,
      to: input.to as `0x${string}`,
      value: input.value ?? 0n,
      data: input.data,
    });
  }

  async getTransaction(hash: string): Promise<ChainTx | null> {
    const c = this.client();
    // `try/catch`: viem lanza TransactionNotFoundError si la transacción aún no llega al nodo
    const tx = await c.getTransaction({ hash: hash as Hash }).catch(() => null);
    if (!tx) return null;
    const receipt = tx.blockNumber
      ? await c.getTransactionReceipt({ hash: hash as Hash }).catch(() => null)
      : null;
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to ?? null,
      value: tx.value,
      chainId: tx.chainId ?? this.chainId,
      input: tx.input,
      blockNumber: tx.blockNumber ?? null,
      status: !receipt
        ? 'pending'
        : receipt.status === 'success'
          ? 'success'
          : 'reverted',
    };
  }

  async getConfirmations(hash: string): Promise<number> {
    // `getTransactionConfirmations` (viem): bloque actual − bloque de la transacción + 1 | sin recibo → 0
    const n = await this.client()
      .getTransactionConfirmations({ hash: hash as Hash })
      .catch(() => 0n);
    return Number(n);
  }
}
