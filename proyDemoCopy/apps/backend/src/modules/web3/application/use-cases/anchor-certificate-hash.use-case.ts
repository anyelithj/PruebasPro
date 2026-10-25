import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bull';
import {
  BLOCKCHAIN_GATEWAY,
  type BlockchainGatewayPort,
} from '../../domain/interfaces/blockchain-gateway.interface';
// [UseCase AnchorCertificateHash · Sprint 7.6]: encola el anclaje del hash SHA-256 de un certificado en una transacción de Sepolia (data = hash) | [Patrón]: Use Case (Command) + Producer (cola Bull) | [Principio]: SRP + DIP | [Paradigma]: Asíncrono + Event-Driven
// [Integración]: lo usará Certificates (sprint 7.8); el worker emite `web3.hash-anchored` { ref, hash, txHash } para que el dueño del certificado guarde el hash de la transacción

export const CERTIFICATE_ANCHOR_QUEUE = 'certificate-anchor';
export const HASH_ANCHORED_EVENT = 'web3.hash-anchored';
export interface CertificateAnchorJob {
  hash: string; // SHA-256 en hex (64 caracteres, sin 0x)
  ref: string; // Id del certificado (u otra referencia del dueño)
}
export interface HashAnchoredEvent extends CertificateAnchorJob {
  txHash: string;
}

@Injectable()
export class AnchorCertificateHashUseCase {
  constructor(
    @Inject(BLOCKCHAIN_GATEWAY) private readonly chain: BlockchainGatewayPort,
    @InjectQueue(CERTIFICATE_ANCHOR_QUEUE)
    private readonly queue: Queue<CertificateAnchorJob>,
  ) {}

  async execute(sha256Hex: string, ref: string): Promise<{ queued: true }> {
    const hash = sha256Hex.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash))
      throw new BadRequestException('Hash SHA-256 inválido');
    if (!this.chain.canSend)
      throw new ServiceUnavailableException(
        'Anclaje no configurado: define WEB3_RPC_URL y WEB3_PLATFORM_PRIVATE_KEY',
      );
    // `jobId`: anclar dos veces el mismo hash del mismo dueño no gasta gas de nuevo
    await this.queue.add(
      { hash, ref },
      {
        jobId: `anchor:${ref}:${hash}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
      },
    );
    return { queued: true };
  }
}
