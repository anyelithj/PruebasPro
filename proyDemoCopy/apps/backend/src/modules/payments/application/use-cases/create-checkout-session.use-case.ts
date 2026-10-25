import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paymentsConfig } from '../../../../shared/config/payments.config';
import { Order } from '../../domain/entities/order.entity';
import { Payment } from '../../domain/entities/payment.entity';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from '../../domain/interfaces/payment-gateway.interface';
import { Money } from '../../domain/value-objects/money.vo';
// [UseCase CreateCheckoutSession · Sprint 7.3]: abre (o reabre) la sesión de pago de una orden pendiente con clave de idempotencia | [Patrón]: Use Case (Command) + Idempotency Key | [Principio]: SRP + DIP (pasarela por su puerto) | [Paradigma]: POO + async/await
// [Idempotencia]: mismo intento = misma clave `checkout:<orden>:<n>` → Stripe devuelve la MISMA sesión (doble clic, reintento de red); un intento vencido abre el siguiente

export interface CheckoutSessionResponse {
  paymentId: string;
  clientSecret: string;
  publishableKey: string; // Clave pública de Stripe (no es secreta) → el navegador no necesita variables de build
}

@Injectable()
export class CreateCheckoutSessionUseCase {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
  ) {}

  async execute(
    user: { sub: string; email: string },
    orderId: string,
  ): Promise<CheckoutSessionResponse> {
    if (!this.gateway.enabled)
      throw new ServiceUnavailableException(
        'Pagos no configurados: define STRIPE_SECRET_KEY (clave de prueba)',
      );
    const order = await this.orders.findOneBy({
      id: orderId,
      userId: user.sub,
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== 'pending')
      throw new ConflictException('La orden ya no está pendiente de pago');

    // [Reintento]: si hay un pago pendiente se reutiliza su id y su clave → misma sesión
    const attempts = await this.payments.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    const pending = attempts.find((p) => p.status === 'pending');
    const paymentId = pending?.id ?? randomUUID();
    const idempotencyKey =
      pending?.idempotencyKey ?? `checkout:${orderId}:${attempts.length + 1}`;

    const session = await this.gateway.createCheckoutSession({
      paymentId,
      orderId,
      idempotencyKey,
      customerEmail: user.email,
      returnUrl: paymentsConfig()
        .returnUrl.replace('{ORDER_ID}', orderId)
        .replace('{PAYMENT_ID}', paymentId),
      // [Snapshot]: nombres y precios copiados en la orden → lo cobrado coincide con lo que vio el usuario
      lines: order.items.map((i) => ({
        name: i.title,
        amount: Money.of(i.amountMinor, order.currency),
      })),
    });

    // `save` hace insert o update por id → pasados 24 h Stripe crea otra sesión con la misma clave y se actualiza `sessionId`
    await this.payments.save(
      this.payments.create({
        id: paymentId,
        orderId,
        userId: user.sub,
        provider: this.gateway.provider,
        status: 'pending',
        sessionId: session.sessionId,
        paymentIntentId: null,
        idempotencyKey,
        amountMinor: order.totalMinor,
        refundedMinor: 0,
        currency: order.currency,
      }),
    );
    return {
      paymentId,
      clientSecret: session.clientSecret,
      publishableKey: paymentsConfig().publishableKey ?? '',
    };
  }
}
