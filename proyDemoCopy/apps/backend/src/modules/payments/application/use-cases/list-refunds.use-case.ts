import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund } from '../../domain/entities/refund.entity';
// [UseCases ListRefunds + GetRefund · Sprint 7.3]: listado y detalle de reembolsos para el panel ADMIN | [Patrón]: Query (CQRS ligero) | [Principio]: SRP | [Paradigma]: POO + async/await

@Injectable()
export class ListRefundsUseCase {
  constructor(
    @InjectRepository(Refund) private readonly refunds: Repository<Refund>,
  ) {}

  // `paymentId` opcional: reembolsos de un pago concreto (pantalla de detalle)
  execute(paymentId?: string): Promise<Refund[]> {
    return this.refunds.find({
      where: paymentId ? { paymentId } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}

@Injectable()
export class GetRefundUseCase {
  constructor(
    @InjectRepository(Refund) private readonly refunds: Repository<Refund>,
  ) {}

  async execute(id: string): Promise<Refund> {
    const refund = await this.refunds.findOneBy({ id });
    if (!refund) throw new NotFoundException('Reembolso no encontrado');
    return refund;
  }
}
