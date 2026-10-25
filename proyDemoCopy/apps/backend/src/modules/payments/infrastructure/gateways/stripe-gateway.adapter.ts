import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { paymentsConfig } from '../../../../shared/config/payments.config';
import type {
  CheckoutSessionResult,
  CreateCheckoutInput,
  GatewayEvent,
  GatewaySessionStatus,
  PaymentGatewayPort,
} from '../../domain/interfaces/payment-gateway.interface';
import type { Money } from '../../domain/value-objects/money.vo';
// [StripeGatewayAdapter · Sprint 7.3]: implementa PaymentGatewayPort con el SDK oficial de Stripe (API 2026-08-26.dahlia, modo prueba) | [Patrón]: Adapter (Hexagonal) + Anti-Corruption Layer (los tipos de Stripe no salen de aquí) | [Principio]: DIP + SRP | [Paradigma]: POO + async/await
// [Integración]: Checkout Sessions con `ui_mode: 'embedded_page'` → el formulario de tarjeta lo pinta Stripe en un iframe (PCI: la tarjeta nunca toca nuestro servidor)
// [Métodos de pago]: sin `payment_method_types` → métodos dinámicos configurados en el Dashboard

// [integration_identifier]: etiqueta del flujo en el Dashboard con 8 letras aleatorias (recomendación de Stripe) | se fija una vez por proceso
// `Array.from(bytes, fn)` (ES2015): cada byte → una letra a–z
const INTEGRATION_ID = `aula-idiomas-cursos-${Array.from(randomBytes(8), (b) => String.fromCharCode(97 + (b % 26))).join('')}`;

@Injectable()
export class StripeGatewayAdapter implements PaymentGatewayPort {
  readonly provider = 'stripe';
  private readonly cfg = paymentsConfig();
  // `new Stripe(key)` (stripe-node): instancia de cliente (no la clave global obsoleta) | sin clave → null y el puerto queda desactivado
  private readonly stripe: Stripe | null = this.cfg.secretKey
    ? new Stripe(this.cfg.secretKey, { maxNetworkRetries: 2 })
    : null;

  // [enabled]: clave secreta + pública (sin la pública el navegador no monta el formulario)
  get enabled(): boolean {
    return this.cfg.enabled;
  }

  // [client]: Fail Fast con 503 legible si faltan las claves
  private client(): Stripe {
    if (!this.stripe)
      throw new ServiceUnavailableException(
        'Pagos no configurados: define STRIPE_SECRET_KEY (clave de prueba)',
      );
    return this.stripe;
  }

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSessionResult> {
    const session = await this.client().checkout.sessions.create(
      {
        mode: 'payment',
        ui_mode: 'embedded_page',
        // `price_data` (Stripe): precio en línea calculado por el servidor → el cliente no puede manipularlo
        line_items: input.lines.map((l) => ({
          quantity: 1,
          price_data: {
            currency: l.amount.stripeCurrency,
            unit_amount: l.amount.amountMinor,
            product_data: { name: l.name },
          },
        })),
        customer_email: input.customerEmail,
        return_url: input.returnUrl,
        client_reference_id: input.orderId,
        // [metadata]: el webhook encuentra la orden y el pago aunque nuestra BD tarde en guardar la sesión
        metadata: { orderId: input.orderId, paymentId: input.paymentId },
        payment_intent_data: {
          metadata: { orderId: input.orderId, paymentId: input.paymentId },
        },
        integration_identifier: INTEGRATION_ID,
      },
      { idempotencyKey: input.idempotencyKey }, // [Idempotencia]: reintento = misma sesión
    );
    if (!session.client_secret)
      throw new ServiceUnavailableException('Stripe no devolvió client_secret');
    return { sessionId: session.id, clientSecret: session.client_secret };
  }

  async getSessionStatus(sessionId: string): Promise<GatewaySessionStatus> {
    const s = await this.client().checkout.sessions.retrieve(sessionId);
    const pi = s.payment_intent;
    return {
      status:
        s.status === 'complete'
          ? 'complete'
          : s.status === 'expired'
            ? 'expired'
            : 'open', // `OtherString` del SDK → 'open'
      paid: s.payment_status === 'paid',
      paymentIntentId: typeof pi === 'string' ? pi : (pi?.id ?? null), // Expandido o id
    };
  }

  async refund(
    paymentIntentId: string,
    amount: Money | null,
    idempotencyKey: string,
  ): Promise<{ refundId: string; status: 'pending' | 'succeeded' | 'failed' }> {
    const r = await this.client().refunds.create(
      {
        payment_intent: paymentIntentId,
        ...(amount ? { amount: amount.amountMinor } : {}),
      },
      { idempotencyKey },
    );
    const status =
      r.status === 'succeeded'
        ? 'succeeded'
        : r.status === 'failed' || r.status === 'canceled'
          ? 'failed'
          : 'pending';
    return { refundId: r.id, status };
  }

  // [parseWebhook]: `constructEvent` verifica la firma HMAC con el cuerpo crudo y la tolerancia de tiempo (anti-replay)
  parseWebhook(rawBody: Buffer, signature: string): GatewayEvent {
    if (!this.cfg.webhookSecret)
      throw new ServiceUnavailableException(
        'Webhook no configurado: define STRIPE_WEBHOOK_SECRET',
      );
    let event: Stripe.Event;
    try {
      event = this.client().webhooks.constructEvent(
        rawBody,
        signature,
        this.cfg.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Firma del webhook inválida'); // Sin detalles: no ayudar a un atacante
    }
    // [Fulfillment]: completed y async_payment_succeeded (gated por payment_status en el caso de uso) | [Patrón]: Translator
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return {
          kind: 'session-paid',
          eventId: event.id,
          sessionId: event.data.object.id,
        };
      case 'checkout.session.async_payment_failed':
        return {
          kind: 'session-failed',
          eventId: event.id,
          sessionId: event.data.object.id,
        };
      case 'checkout.session.expired':
        return {
          kind: 'session-expired',
          eventId: event.id,
          sessionId: event.data.object.id,
        };
      default:
        return { kind: 'ignored', eventId: event.id, type: event.type };
    }
  }
}
