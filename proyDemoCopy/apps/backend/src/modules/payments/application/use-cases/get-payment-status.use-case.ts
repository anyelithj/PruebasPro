import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../../users/domain/value-objects/role.vo';
import { Payment } from '../../domain/entities/payment.entity';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from '../../domain/interfaces/payment-gateway.interface';
import { HandleGatewayWebhookUseCase } from './handle-gateway-webhook.use-case';
// [UseCases GetPaymentStatus + ListMyPayments · Sprint 7.3]: estado de un pago (lo consulta periódicamente la pantalla de regreso) e historial del usuario | [Patrón]: Query (CQRS ligero) + Reconciliación bajo demanda | [Principio]: SRP + DRY (reutiliza `apply` del webhook) | [Paradigma]: POO + async/await
// [Por qué reconciliar]: en desarrollo el webhook puede no estar configurado (`stripe listen`); si el pago sigue pendiente se pregunta a la pasarela

@Injectable()
export class GetPaymentStatusUseCase {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    private readonly webhook: HandleGatewayWebhookUseCase,
  ) {}

  async execute(
    user: { sub: string; role: Role },
    id: string,
  ): Promise<Payment> {
    const payment = await this.payments.findOneBy({ id });
    if (!payment || (payment.userId !== user.sub && user.role !== Role.ADMIN))
      throw new NotFoundException('Pago no encontrado'); // Ajeno = 404
    if (payment.status !== 'pending' || !this.gateway.enabled) return payment;
    await this.webhook.apply(
      payment,
      await this.gateway.getSessionStatus(payment.sessionId),
    );
    return (await this.payments.findOneBy({ id })) ?? payment; // Relee tras la posible transición
  }
}

@Injectable()
export class ListMyPaymentsUseCase {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
  ) {}

  // [ADMIN]: ve los pagos de todos (la pantalla /pagos le muestra el botón de reembolso) · resto: solo los suyos
  execute(user: { sub: string; role: Role }): Promise<Payment[]> {
    return this.payments.find({
      where: user.role === Role.ADMIN ? {} : { userId: user.sub },
      order: { createdAt: 'DESC' },
      take: user.role === Role.ADMIN ? 100 : 50,
    });
  }
}
