import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Job } from 'bull';
import {
  CERTIFICATE_ANCHOR_QUEUE,
  HASH_ANCHORED_EVENT,
  type CertificateAnchorJob,
  type HashAnchoredEvent,
} from '../../application/use-cases/anchor-certificate-hash.use-case';
import {
  BLOCKCHAIN_GATEWAY,
  type BlockchainGatewayPort,
} from '../../domain/interfaces/blockchain-gateway.interface';
// [Worker CertificateAnchor · Sprint 7.6]: ancla el hash enviando una transacción de 0 ETH de la plataforma a sí misma con `data = 0x<sha256>` y publica el hash de la transacción | [Patrón]: Consumer (cola Bull) + Domain Event | [Principio]: SRP + bajo acoplamiento (Web3 no conoce la tabla de certificados) | [Paradigma]: Asíncrono + Event-Driven
// [Por qué sin contrato]: una transacción con data es suficiente prueba de existencia en la fecha del bloque (decisión del informe: Sepolia sin contratos)

@Processor(CERTIFICATE_ANCHOR_QUEUE)
export class CertificateAnchorProcessor {
  private readonly logger = new Logger(CertificateAnchorProcessor.name);

  constructor(
    @Inject(BLOCKCHAIN_GATEWAY) private readonly chain: BlockchainGatewayPort,
    private readonly events: EventEmitter2,
  ) {}

  @Process()
  async handle(job: Job<CertificateAnchorJob>): Promise<string> {
    const to = this.chain.platformAddress;
    if (!to) throw new Error('Sin cuenta de la plataforma'); // Bull reintenta; la configuración se valida al arrancar
    const txHash = await this.chain.sendTransaction({
      to,
      value: 0n,
      data: `0x${job.data.hash}`,
    });
    const event: HashAnchoredEvent = { ...job.data, txHash };
    this.events.emit(HASH_ANCHORED_EVENT, event); // Certificates (7.8) guarda el txHash en su tabla
    this.logger.log(`Hash anclado (${job.data.ref}) en ${txHash}`);
    return txHash;
  }
}
