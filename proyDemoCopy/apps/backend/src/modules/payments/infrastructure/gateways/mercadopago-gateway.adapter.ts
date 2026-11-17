import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { paymentsConfig } from '../../../../shared/config/payments.config';
import type {
  CheckoutSessionResult,
  CreateCheckoutInput,
  GatewayEvent,
  GatewaySessionStatus,
  PaymentGatewayPort,
  WebhookMeta,
} from '../../domain/interfaces/payment-gateway.interface';
import type { Money } from '../../domain/value-objects/money.vo';
// [MercadoPagoGatewayAdapter · 2026-11-16]: PaymentGatewayPort con Checkout Pro de Mercado Pago Colombia (credenciales de PRUEBA gratuitas, sin dinero real)
// [Integración]: API REST oficial con `fetch` nativo (sin SDK → sin dependencia nueva) · docs: https://www.mercadopago.com.co/developers/es/docs/checkout-pro
// [Flujo]: preferencia → el navegador va a `init_point` (página de Mercado Pago, PCI: la tarjeta nunca toca nuestro servidor) → vuelve a la return_url
// → la pantalla de confirmación consulta el estado (getSessionStatus) y, si hay URL pública, también llega el webhook firmado
// [Sesión]: `sessionId` = NUESTRO paymentId (va en `external_reference`) → buscar el pago en Mercado Pago no necesita guardar el id de la preferencia
// [Moneda]: Mercado Pago Colombia cobra en COP sin decimales → si la orden está en otra moneda se convierte con MERCADOPAGO_USD_COP_RATE
// [Patrón]: Adapter (Hexagonal) + Anti-Corruption Layer (los JSON de Mercado Pago no salen de aquí) | [Principio]: DIP + OCP (Stripe sigue igual) | [Paradigma]: POO + async/await

const API = 'https://api.mercadopago.com';

interface MpPayment {
  id: number;
  status: string; // approved · pending · in_process · rejected · cancelled · refunded…
  external_reference: string | null;
}

@Injectable()
export class MercadoPagoGatewayAdapter implements PaymentGatewayPort {
  readonly provider = 'mercadopago';
  private readonly cfg = paymentsConfig();

  get enabled(): boolean {
    return !!this.cfg.mercadoPago.accessToken;
  }

  // [call]: una sola puerta a la API (token Bearer + JSON + errores 503 legibles) | [Principio]: DRY
  private async call<T>(
    path: string,
    init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    const token = this.cfg.mercadoPago.accessToken;
    if (!token)
      throw new ServiceUnavailableException(
        'Pagos no configurados: define MERCADOPAGO_ACCESS_TOKEN (credencial de prueba)',
      );
    const res = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.idempotencyKey
          ? { 'X-Idempotency-Key': init.idempotencyKey }
          : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
      throw new ServiceUnavailableException(
        `Mercado Pago respondió ${res.status}`, // Sin el cuerpo: puede traer datos del comprador
      );
    return (await res.json()) as T;
  }

  // [toCop]: Money (centavos, cualquier moneda) → pesos colombianos enteros | `Math.round`: COP no admite decimales en Mercado Pago
  private toCop(m: Money): number {
    const major = m.amountMinor / 100;
    return Math.max(
      1,
      Math.round(
        m.currency === 'COP' ? major : major * this.cfg.mercadoPago.usdCopRate,
      ),
    );
  }

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSessionResult> {
    const notification = this.cfg.mercadoPago.notificationUrl;
    const pref = await this.call<{
      id: string;
      init_point: string;
      sandbox_init_point?: string;
    }>('/checkout/preferences', {
      method: 'POST',
      idempotencyKey: input.idempotencyKey, // Reintento = misma preferencia
      body: {
        // Precios calculados en el servidor → el cliente no puede manipularlos
        items: input.lines.map((l, i) => ({
          id: `${input.orderId}-${i + 1}`,
          title: l.name.slice(0, 250),
          quantity: 1,
          currency_id: 'COP',
          unit_price: this.toCop(l.amount),
        })),
        payer: input.customerEmail ? { email: input.customerEmail } : undefined,
        external_reference: input.paymentId,
        metadata: { order_id: input.orderId, payment_id: input.paymentId },
        back_urls: {
          success: input.returnUrl,
          pending: input.returnUrl,
          failure: input.returnUrl,
        },
        // `auto_return`: Mercado Pago solo lo acepta con URL https → en local (http://localhost) el usuario pulsa «Volver al sitio»
        ...(input.returnUrl.startsWith('https://')
          ? { auto_return: 'approved' }
          : {}),
        ...(notification ? { notification_url: notification } : {}), // Webhook: necesita URL pública (ngrok/cloudflared en local)
      },
    });
    // [Prueba]: con credenciales TEST-… se usa el checkout de pruebas (sandbox) si viene en la respuesta
    const sandbox = this.cfg.mercadoPago.accessToken?.startsWith('TEST-');
    return {
      sessionId: input.paymentId,
      clientSecret: '',
      redirectUrl:
        (sandbox ? pref.sandbox_init_point : undefined) ?? pref.init_point,
    };
  }

  // [getSessionStatus]: pagos de Mercado Pago con nuestra external_reference → aprobado = pagado
  async getSessionStatus(sessionId: string): Promise<GatewaySessionStatus> {
    const q = new URLSearchParams({
      external_reference: sessionId,
      sort: 'date_created',
      criteria: 'desc',
    });
    const { results } = await this.call<{ results: MpPayment[] }>(
      `/v1/payments/search?${q}`,
    );
    const approved = results.find((p) => p.status === 'approved');
    if (approved)
      return {
        status: 'complete',
        paid: true,
        paymentIntentId: String(approved.id),
      };
    // Solo rechazos/cancelaciones y ninguno pendiente → el intento terminó sin cobro
    const closed =
      results.length > 0 &&
      results.every((p) => p.status === 'rejected' || p.status === 'cancelled');
    return {
      status: closed ? 'expired' : 'open',
      paid: false,
      paymentIntentId: null,
    };
  }

  async refund(
    paymentIntentId: string,
    amount: Money | null,
    idempotencyKey: string,
  ): Promise<{ refundId: string; status: 'pending' | 'succeeded' | 'failed' }> {
    const r = await this.call<{ id: number; status: string }>(
      `/v1/payments/${encodeURIComponent(paymentIntentId)}/refunds`,
      {
        method: 'POST',
        idempotencyKey,
        body: amount ? { amount: this.toCop(amount) } : {},
      },
    );
    const status =
      r.status === 'approved'
        ? 'succeeded'
        : r.status === 'rejected' || r.status === 'cancelled'
          ? 'failed'
          : 'pending';
    return { refundId: String(r.id), status };
  }

  // [parseWebhook]: firma `x-signature: ts=…,v1=…` = HMAC-SHA256(secreto, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")
  // Después se CONSULTA el pago en la API (nunca se confía en el estado que trae la notificación) | [Seguridad]: comparación en tiempo constante
  async parseWebhook(
    rawBody: Buffer,
    signature: string,
    meta: WebhookMeta = {},
  ): Promise<GatewayEvent> {
    const secret = this.cfg.mercadoPago.webhookSecret;
    if (!secret)
      throw new ServiceUnavailableException(
        'Webhook no configurado: define MERCADOPAGO_WEBHOOK_SECRET',
      );
    let body: { type?: string; data?: { id?: string | number } } = {};
    try {
      body = JSON.parse(rawBody.toString('utf8') || '{}') as typeof body;
    } catch {
      throw new BadRequestException('Cuerpo del webhook inválido');
    }
    const dataId = String(meta.dataId ?? body.data?.id ?? '').toLowerCase(); // Mercado Pago firma el id en minúsculas
    const parts = Object.fromEntries(
      signature
        .split(',')
        .map((kv) => kv.trim().split('=') as [string, string]),
    );
    const manifest = `id:${dataId};request-id:${meta.requestId ?? ''};ts:${parts.ts ?? ''};`;
    const expected = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    const given = Buffer.from(parts.v1 ?? '', 'utf8');
    if (
      !dataId ||
      given.length !== expected.length ||
      !timingSafeEqual(given, Buffer.from(expected, 'utf8'))
    )
      throw new BadRequestException('Firma del webhook inválida');

    const eventId = `mp:${meta.requestId ?? dataId}`;
    if ((meta.topic ?? body.type) !== 'payment')
      return { kind: 'ignored', eventId, type: meta.topic ?? body.type ?? '' };
    const p = await this.call<MpPayment>(
      `/v1/payments/${encodeURIComponent(dataId)}`,
    );
    if (!p.external_reference)
      return { kind: 'ignored', eventId, type: 'payment-without-reference' };
    if (p.status === 'approved')
      return { kind: 'session-paid', eventId, sessionId: p.external_reference };
    if (p.status === 'rejected' || p.status === 'cancelled')
      return {
        kind: 'session-failed',
        eventId,
        sessionId: p.external_reference,
      };
    return { kind: 'ignored', eventId, type: `payment.${p.status}` };
  }
}
