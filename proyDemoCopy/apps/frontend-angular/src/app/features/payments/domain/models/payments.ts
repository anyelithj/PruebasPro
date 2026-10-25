import { z } from 'zod';
// [Modelo Payments · Dominio]: orden, pago, sesión de checkout y reembolso (contrato de /api/payments/* del backend NestJS) + reglas puras | [Patrón]: Schema-First (Zod) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional (funciones puras)
// [Montos]: siempre en unidades mínimas (centavos) como el backend → sin errores de coma flotante

export const ORDER_STATUSES = ['pending', 'paid', 'cancelled', 'expired', 'refunded'] as const;
export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'expired', 'partially_refunded', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const OrderSchema = z.object({
  id: z.string(),
  status: z.enum(ORDER_STATUSES),
  items: z.array(z.object({ courseId: z.string(), title: z.string(), amountMinor: z.number().int() })),
  totalMinor: z.number().int(),
  currency: z.string().length(3),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
});
export type Order = z.infer<typeof OrderSchema>; // `z.infer` (Zod): tipo derivado del esquema (DRY)

export const PaymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: z.enum(PAYMENT_STATUSES),
  amountMinor: z.number().int(),
  refundedMinor: z.number().int(),
  currency: z.string().length(3),
  createdAt: z.string(),
});
export type Payment = z.infer<typeof PaymentSchema>;

// [CheckoutSession]: `clientSecret` monta el formulario embebido de Stripe; `publishableKey` es pública (no es un secreto)
export const CheckoutSessionSchema = z.object({ paymentId: z.string(), clientSecret: z.string().min(1), publishableKey: z.string().min(1) });
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;

export const RefundSchema = z.object({
  id: z.string(),
  paymentId: z.string(),
  amountMinor: z.number().int(),
  currency: z.string(),
  status: z.enum(['pending', 'succeeded', 'failed']),
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export type Refund = z.infer<typeof RefundSchema>;

// [formatMoney]: 1999 USD → «US$19,99» en el idioma activo | `Intl.NumberFormat` (ECMA-402)
export const formatMoney = (minor: number, currency: string, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);

// [isFinal]: el sondeo de estado se detiene cuando el pago ya no puede cambiar solo
export const isFinal = (status: PaymentStatus): boolean => status !== 'pending';

// [refundable]: queda algo por reembolsar en un pago confirmado
export const refundable = (p: Payment): number =>
  p.status === 'succeeded' || p.status === 'partially_refunded' ? p.amountMinor - p.refundedMinor : 0;
