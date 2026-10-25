import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../../courses/domain/interfaces/course.repository.interface';
import { Order } from '../../domain/entities/order.entity';
import { Payment } from '../../domain/entities/payment.entity';
import { Refund } from '../../domain/entities/refund.entity';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from '../../domain/interfaces/payment-gateway.interface';
import { Money } from '../../domain/value-objects/money.vo';
// [UseCase RefundPayment · Sprint 7.3]: reembolso total o parcial pedido por un ADMIN; el total revoca el acceso a los cursos | [Patrón]: Use Case (Command) + Idempotency Key + Audit Trail | [Principio]: SRP + DIP | [Paradigma]: POO + async/await
// [Idempotencia]: la clave incluye lo ya reembolsado → repetir la misma petición no reembolsa dos veces

@Injectable()
export class RefundPaymentUseCase {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Refund) private readonly refunds: Repository<Refund>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository,
  ) {}

  // `amountMinor` undefined = lo que queda por reembolsar
  async execute(
    adminId: string,
    paymentId: string,
    amountMinor?: number,
    reason?: string,
  ): Promise<Refund> {
    const payment = await this.payments.findOneBy({ id: paymentId });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (
      !['succeeded', 'partially_refunded'].includes(payment.status) ||
      !payment.paymentIntentId
    )
      throw new ConflictException('Solo se reembolsa un pago confirmado');
    const remaining = payment.amountMinor - payment.refundedMinor;
    const amount = amountMinor ?? remaining;
    if (amount <= 0 || amount > remaining)
      throw new BadRequestException(
        `El monto debe estar entre 1 y ${remaining} (centavos)`,
      );

    const result = await this.gateway.refund(
      payment.paymentIntentId,
      amount === remaining && payment.refundedMinor === 0
        ? null
        : Money.of(amount, payment.currency), // null = total
      `refund:${payment.id}:${payment.refundedMinor}:${amount}`,
    );
    const refund = await this.refunds.save(
      this.refunds.create({
        paymentId,
        amountMinor: amount,
        currency: payment.currency,
        status: result.status,
        providerRefundId: result.refundId,
        reason: reason ?? null,
        createdBy: adminId,
      }),
    );
    if (result.status === 'failed') return refund;

    payment.refundedMinor += amount;
    payment.status =
      payment.refundedMinor >= payment.amountMinor
        ? 'refunded'
        : 'partially_refunded';
    await this.payments.save(payment);
    if (payment.status === 'refunded') await this.revokeAccess(payment.orderId);
    return refund;
  }

  // [revokeAccess]: reembolso total → orden reembolsada y cursos bloqueados de nuevo (`purchasedAt: null`)
  private async revokeAccess(orderId: string): Promise<void> {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) return;
    order.status = 'refunded';
    await this.orders.save(order);
    for (const item of order.items)
      await this.courses.upsertEnrollment(order.userId, item.courseId, {
        purchasedAt: null,
      });
  }
}
