import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesModule } from '../courses/courses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case';
import { CreateCheckoutSessionUseCase } from './application/use-cases/create-checkout-session.use-case';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import {
  GetPaymentStatusUseCase,
  ListMyPaymentsUseCase,
} from './application/use-cases/get-payment-status.use-case';
import { FulfillOrderUseCase } from './application/use-cases/fulfill-order.use-case';
import { HandleGatewayWebhookUseCase } from './application/use-cases/handle-gateway-webhook.use-case';
import {
  GetOrderUseCase,
  ListMyOrdersUseCase,
} from './application/use-cases/list-my-orders.use-case';
import {
  GetRefundUseCase,
  ListRefundsUseCase,
} from './application/use-cases/list-refunds.use-case';
import { RefundPaymentUseCase } from './application/use-cases/refund-payment.use-case';
import { Order } from './domain/entities/order.entity';
import { Payment } from './domain/entities/payment.entity';
import { Refund } from './domain/entities/refund.entity';
import { PAYMENT_GATEWAY } from './domain/interfaces/payment-gateway.interface';
import { StripeGatewayAdapter } from './infrastructure/gateways/stripe-gateway.adapter';
import { OrdersController } from './presentation/orders.controller';
import { GetInvoiceUseCase } from './application/use-cases/get-invoice.use-case';
import { PaymentsController } from './presentation/payments.controller';
import { RefundsController } from './presentation/refunds.controller';
// [PaymentsModule · Sprint 7.3]: órdenes, pagos con pasarela (Stripe, modo prueba), webhooks firmados y reembolsos | [Patrón]: Module + DI Container + Ports & Adapters | [Principio]: DIP (PAYMENT_GATEWAY → StripeGatewayAdapter) + OCP (otra pasarela = otro useClass)
// ponytail: el webhook se concilia en línea (rápido, idempotente); si crece el trabajo posterior (correo, factura) → cola Bull como Reports

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment, Refund]),
    CoursesModule, // COURSE_REPOSITORY: precios del catálogo y acceso a los cursos
    NotificationsModule, // PublishNotificationUseCase: aviso «Pago confirmado» en la campana
  ],
  controllers: [OrdersController, RefundsController, PaymentsController],
  providers: [
    { provide: PAYMENT_GATEWAY, useClass: StripeGatewayAdapter },
    CreateOrderUseCase,
    ListMyOrdersUseCase,
    GetOrderUseCase,
    GetInvoiceUseCase, // [Sprint 2.6]: factura PDF
    CancelOrderUseCase,
    CreateCheckoutSessionUseCase,
    GetPaymentStatusUseCase,
    ListMyPaymentsUseCase,
    FulfillOrderUseCase,
    HandleGatewayWebhookUseCase,
    RefundPaymentUseCase,
    ListRefundsUseCase,
    GetRefundUseCase,
  ],
  // [Sprint 7.6]: Web3 lee la orden y la completa con los mismos casos de uso (DRY)
  exports: [GetOrderUseCase, FulfillOrderUseCase],
})
export class PaymentsModule {}
