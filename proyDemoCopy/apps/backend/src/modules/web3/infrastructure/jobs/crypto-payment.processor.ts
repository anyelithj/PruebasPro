import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { ConfirmOnchainPaymentUseCase } from '../../application/use-cases/confirm-onchain-payment.use-case';
import {
  CRYPTO_PAYMENT_QUEUE,
  type CryptoPaymentJob,
} from '../../application/use-cases/register-crypto-tx.use-case';
// [Worker CryptoPayment · Sprint 7.6]: verifica el pago cripto fuera del ciclo HTTP y se reprograma hasta alcanzar las confirmaciones | [Patrón]: Consumer (cola Bull) + Polling con tope | [Principio]: SRP (la lógica vive en ConfirmOnchainPaymentUseCase) | [Paradigma]: Asíncrono
// [Tope]: 80 vueltas × 15 s ≈ 20 min; Sepolia confirma un bloque cada ~12 s

const RECHECK_MS = 15_000;
const MAX_ATTEMPTS = 80;

@Processor(CRYPTO_PAYMENT_QUEUE)
export class CryptoPaymentProcessor {
  private readonly logger = new Logger(CryptoPaymentProcessor.name);

  constructor(
    private readonly confirm: ConfirmOnchainPaymentUseCase,
    @InjectQueue(CRYPTO_PAYMENT_QUEUE)
    private readonly queue: Queue<CryptoPaymentJob>,
  ) {}

  @Process()
  async handle(job: Job<CryptoPaymentJob>): Promise<void> {
    const status = await this.confirm.execute(job.data.id); // Un error del RPC lanza → Bull reintenta con backoff
    if (status !== 'confirming') return;
    const attempt = job.data.attempt + 1;
    if (attempt >= MAX_ATTEMPTS) {
      this.logger.warn(
        `Pago cripto ${job.data.id}: sin confirmaciones suficientes tras ${attempt} vueltas`,
      );
      return;
    }
    // `delay` (Bull): siguiente consulta dentro de 15 s | jobId distinto por vuelta (el anterior ya terminó)
    await this.queue.add(
      { id: job.data.id, attempt },
      {
        jobId: `crypto:${job.data.id}:${attempt}`,
        delay: RECHECK_MS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );
  }
}
