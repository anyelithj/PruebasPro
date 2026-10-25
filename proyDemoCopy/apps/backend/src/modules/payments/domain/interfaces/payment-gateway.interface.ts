import type { Money } from '../value-objects/money.vo';
// [Port PaymentGatewayPort · Sprint 7.3]: contrato de la pasarela de pago que usa el dominio (Stripe hoy, otra mañana) | [Patrón]: Port (Hexagonal) + Strategy | [Principio]: DIP (los casos de uso no conocen el SDK) + OCP (pasarela nueva = adaptador nuevo) | [Paradigma]: POO

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY'); // Token de inyección (las interfaces de TS no existen en runtime)

// [Línea de cobro]: nombre visible en la pantalla de pago + precio calculado en el servidor
export interface CheckoutLine {
  name: string;
  amount: Money;
}

export interface CreateCheckoutInput {
  paymentId: string; // Id propio → metadata y URL de regreso
  orderId: string;
  lines: CheckoutLine[];
  customerEmail?: string;
  returnUrl: string;
  idempotencyKey: string; // Reintentar la misma petición no crea dos sesiones
}

export interface CheckoutSessionResult {
  sessionId: string;
  clientSecret: string; // Lo usa @stripe/stripe-js para montar el formulario embebido
}

// [Estado normalizado]: lo que el dominio necesita saber de una sesión, sin tipos del SDK
export interface GatewaySessionStatus {
  status: 'open' | 'complete' | 'expired';
  paid: boolean; // `payment_status === 'paid'`
  paymentIntentId: string | null; // Necesario para reembolsar
}

// [Evento normalizado]: el webhook ya verificado y traducido | `ignored` = evento que no nos interesa
export type GatewayEvent =
  | { kind: 'session-paid'; eventId: string; sessionId: string }
  | { kind: 'session-failed'; eventId: string; sessionId: string }
  | { kind: 'session-expired'; eventId: string; sessionId: string }
  | { kind: 'ignored'; eventId: string; type: string };

export interface PaymentGatewayPort {
  readonly provider: string; // 'stripe'
  readonly enabled: boolean; // false sin claves → los casos de uso responden 503
  createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSessionResult>;
  getSessionStatus(sessionId: string): Promise<GatewaySessionStatus>;
  // `amount` null = reembolso total
  refund(
    paymentIntentId: string,
    amount: Money | null,
    idempotencyKey: string,
  ): Promise<{ refundId: string; status: 'pending' | 'succeeded' | 'failed' }>;
  // [parseWebhook]: verifica la firma con el cuerpo CRUDO y lanza si no es válida | [Seguridad]: nunca confiar en un webhook sin firma
  parseWebhook(rawBody: Buffer, signature: string): GatewayEvent;
}
