import { Inject, Injectable } from '@nestjs/common';
import {
  BLOCKCHAIN_GATEWAY,
  type BlockchainGatewayPort,
} from '../../domain/interfaces/blockchain-gateway.interface';
import { EvmAddress } from '../../domain/value-objects/evm-address.vo';
// [UseCase VerifyCertificateHash · Sprint 7.6 · RF-93]: lee la transacción de anclaje con viem y compara su `data` con el SHA-256 del PDF | [Patrón]: Query | [Principio]: SRP + DIP | [Paradigma]: POO + async/await
// [Confianza]: válido solo si la emitió la cuenta de la plataforma, no se revirtió y su data es exactamente el hash → nadie falsifica un certificado anclando su propio hash

export interface HashVerification {
  valid: boolean;
  confirmations: number;
  blockNumber: string | null; // bigint como texto (JSON)
}

@Injectable()
export class VerifyCertificateHashUseCase {
  constructor(
    @Inject(BLOCKCHAIN_GATEWAY) private readonly chain: BlockchainGatewayPort,
  ) {}

  async execute(txHash: string, sha256Hex: string): Promise<HashVerification> {
    const tx = /^0x[0-9a-fA-F]{64}$/.test(txHash)
      ? await this.chain.getTransaction(txHash)
      : null;
    const platform = this.chain.platformAddress;
    const valid =
      !!tx &&
      !!platform &&
      tx.status === 'success' &&
      EvmAddress.parse(platform).equals(tx.from) &&
      tx.input.toLowerCase() === `0x${sha256Hex.toLowerCase()}`;
    return {
      valid,
      confirmations: valid ? await this.chain.getConfirmations(txHash) : 0,
      blockNumber: tx?.blockNumber?.toString() ?? null,
    };
  }
}
