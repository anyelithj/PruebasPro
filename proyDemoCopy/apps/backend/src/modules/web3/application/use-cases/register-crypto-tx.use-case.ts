import { InjectQueue } from '@nestjs/bull';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { CryptoPayment } from '../../domain/entities/crypto-payment.entity';
// [UseCase RegisterCryptoTx · Sprint 7.6]: guarda el hash de la transacción enviada desde la billetera y encola su verificación en segundo plano | [Patrón]: Use Case (Command) + Producer (cola Bull) + Idempotency Key (txHash) | [Principio]: SRP | [Paradigma]: Asíncrono
// [Idempotencia]: repetir el mismo txHash devuelve el mismo pago; otro hash distinto para un pago ya en curso es 409

export const CRYPTO_PAYMENT_QUEUE = 'crypto-payment'; // [SSOT]: nombre de la cola (productor y worker)
export interface CryptoPaymentJob {
  id: string;
  attempt: number; // El worker reprograma la verificación hasta alcanzar las confirmaciones o caducar
}

@Injectable()
export class RegisterCryptoTxUseCase {
  constructor(
    @InjectRepository(CryptoPayment)
    private readonly payments: Repository<CryptoPayment>,
    @InjectQueue(CRYPTO_PAYMENT_QUEUE)
    private readonly queue: Queue<CryptoPaymentJob>,
  ) {}

  async execute(
    userId: string,
    id: string,
    txHash: string,
  ): Promise<CryptoPayment> {
    const hash = txHash.toLowerCase();
    const p = await this.payments.findOneBy({ id, userId });
    if (!p) throw new NotFoundException('Pago cripto no encontrado');
    if (p.txHash === hash) return p; // Reenvío del mismo hash
    if (p.txHash || p.status !== 'pending')
      throw new ConflictException(
        'Este pago ya tiene una transacción registrada',
      );
    if (p.expiresAt.getTime() < Date.now())
      throw new ConflictException('El pago caducó: crea uno nuevo');
    if (await this.payments.exist({ where: { txHash: hash } }))
      throw new ConflictException('Esa transacción ya pagó otra orden');

    // [Candado]: solo pasa a CONFIRMANDO si seguía PENDIENTE (dos pestañas a la vez)
    const res = await this.payments.update(
      { id, status: 'pending' },
      { txHash: hash, status: 'confirming' },
    );
    if (!res.affected)
      throw new ConflictException(
        'El pago cambió de estado; vuelve a consultarlo',
      );
    // `jobId` (Bull): el mismo pago no se encola dos veces | backoff para errores del RPC
    await this.queue.add(
      { id, attempt: 0 },
      {
        jobId: `crypto:${id}:0`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );
    return { ...p, txHash: hash, status: 'confirming' };
  }
}
