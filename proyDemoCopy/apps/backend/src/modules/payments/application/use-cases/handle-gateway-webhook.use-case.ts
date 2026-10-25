import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../domain/entities/order.entity';
import { Payment } from '../../domain/entities/payment.entity';
import {
  PAYMENT_GATEWAY,
  type GatewaySessionStatus,
  type PaymentGatewayPort,
} from '../../domain/interfaces/payment-gateway.interface';
import { FulfillOrderUseCase } from './fulfill-order.use-case';
// [UseCase HandleGatewayWebhook · Sprint 7.3]: concilia el webhook FIRMADO de la pasarela → confirma el pago, marca la orden pagada y desbloquea los cursos | [Patrón]: Use Case (Command) + State + Idempotent Receiver | [Principio]: SRP + DIP | [Paradigma]: Event-Driven + async/await
// [Idempotencia]: Stripe reintenta webhooks → `UPDATE … WHERE status = 'pending'` deja que solo UNA entrega haga el trabajo
// [Fulfillment]: aquí y no en la pantalla de regreso (puede cerrarse antes); `apply` también lo usa la consulta de estado si el webhook aún no llegó

@Injectable()
export class HandleGatewayWebhookUseCase {
  private readonly logger = new Logger(HandleGatewayWebhookUseCase.name);

  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    private readonly fulfillOrder: FulfillOrderUseCase,
  ) {}

  // [execute]: verifica la firma (lanza 400 si no es válida) y aplica el evento | siempre 200 para eventos ajenos → Stripe deja de reintentar
  async execute(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true }> {
    const event = this.gateway.parseWebhook(rawBody, signature);
    if (event.kind === 'ignored') return { received: true };
    const payment = await this.payments.findOneBy({
      sessionId: event.sessionId,
    });
    if (!payment) {
      this.logger.warn(`Webhook ${event.eventId}: sesión desconocida`); // Sin datos personales en el log
      return { received: true };
    }
    if (event.kind === 'session-paid') {
      // [Gate por payment_status]: `completed` también llega con pagos asíncronos aún sin cobrar → se consulta el estado real
      await this.apply(
        payment,
        await this.gateway.getSessionStatus(event.sessionId),
      );
    } else if (event.kind === 'session-failed') {
      await this.payments.update(
        { id: payment.id, status: 'pending' },
        { status: 'failed' },
      );
    } else {
      await this.expire(payment);
    }
    return { received: true };
  }

  // [apply]: estado de la sesión → transición del pago | [Patrón]: State Machine
  async apply(payment: Payment, s: GatewaySessionStatus): Promise<void> {
    if (s.paid) await this.fulfill(payment, s.paymentIntentId);
    else if (s.status === 'expired') await this.expire(payment);
  }

  // [fulfill]: pago confirmado (candado optimista en `payments`) → la orden la completa FulfillOrderUseCase (compartido con Web3)
  private async fulfill(
    payment: Payment,
    paymentIntentId: string | null,
  ): Promise<void> {
    const res = await this.payments.update(
      { id: payment.id, status: 'pending' },
      { status: 'succeeded', paymentIntentId },
    );
    if (res.affected)
      await this.fulfillOrder.execute(payment.orderId, 'tarjeta');
  }

  // [expire]: sesión vencida sin cobro → el pago y la orden quedan cerrados (se puede crear otra orden)
  private async expire(payment: Payment): Promise<void> {
    const res = await this.payments.update(
      { id: payment.id, status: 'pending' },
      { status: 'expired' },
    );
    if (res.affected)
      await this.orders.update(
        { id: payment.orderId, status: 'pending' },
        { status: 'expired' },
      );
  }
}
