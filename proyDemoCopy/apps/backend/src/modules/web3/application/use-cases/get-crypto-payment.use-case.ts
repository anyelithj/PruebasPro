import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoPayment } from '../../domain/entities/crypto-payment.entity';
// [UseCases GetCryptoPayment + ListMyCryptoPayments · Sprint 7.6]: estado y confirmaciones de un pago cripto e historial del usuario | [Patrón]: Query (CQRS ligero) + caducidad perezosa | [Principio]: SRP | [Paradigma]: POO + async/await
// [Caducidad perezosa]: un pago PENDIENTE sin transacción pasa a EXPIRADO al consultarlo después de `expiresAt` (no hace falta un cron)

@Injectable()
export class GetCryptoPaymentUseCase {
  constructor(
    @InjectRepository(CryptoPayment)
    private readonly payments: Repository<CryptoPayment>,
  ) {}

  async execute(userId: string, id: string): Promise<CryptoPayment> {
    const p = await this.payments.findOneBy({ id, userId }); // Ajeno = 404
    if (!p) throw new NotFoundException('Pago cripto no encontrado');
    if (p.status === 'pending' && p.expiresAt.getTime() < Date.now()) {
      await this.payments.update(
        { id, status: 'pending' },
        { status: 'expired' },
      );
      p.status = 'expired';
    }
    return p;
  }
}

@Injectable()
export class ListMyCryptoPaymentsUseCase {
  constructor(
    @InjectRepository(CryptoPayment)
    private readonly payments: Repository<CryptoPayment>,
  ) {}

  execute(userId: string): Promise<CryptoPayment[]> {
    return this.payments.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
