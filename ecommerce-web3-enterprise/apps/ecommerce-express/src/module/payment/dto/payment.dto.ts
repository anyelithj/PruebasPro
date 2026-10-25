// payment.dto.ts => contratos de salida del módulo Payment.
import type { PaymentStatus } from "@prisma/client";

export interface PaymentDto {
  id: string;
  checkoutSessionId: string;
  orderId: string | null;
  provider: string;
  amountCents: number;
  refundedCents: number;
  currency: string;
  status: PaymentStatus;
  failureReason: string | null;
  details: unknown; // RF-08.3/08.9 datos propios del medio (cotización cripto, cuenta para transferir)
  createdAt: Date;
}

// OfflinePaymentDto => RF-08.3 transferencia bancaria / contra entrega / cripto: qué hacer a continuación
export interface OfflinePaymentDto {
  paymentId: string;
  provider: "BANK_TRANSFER" | "CASH_ON_DELIVERY" | "CRYPTO";
  status: string;
  details: Record<string, unknown>; // Banco y referencia, o activo/red/dirección/monto/tasa
  orderId: string | null; // Contra entrega: el pedido ya quedó colocado
}

// PaymentIntentDto => lo que necesita Stripe Elements en el navegador para confirmar el pago
// (el client_secret NO es una credencial del comercio: solo permite confirmar ESTE PaymentIntent)
export interface PaymentIntentDto {
  paymentId: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
  status?: string | undefined; // RF-08.1 un clic: "succeeded" o "requires_action" (3-D Secure en el navegador)
  checkoutSessionId?: string | undefined;
}

// SavedPaymentMethodDto => RF-02.3 método de pago TOKENIZADO en Stripe: solo datos de presentación (marca, 4 últimos
// dígitos, vencimiento). El número completo y el CVC nunca existen en nuestro sistema (PCI DSS: SAQ-A)
export interface SavedPaymentMethodDto {
  id: string; // "pm_..." => identificador del token en Stripe
  type: string; // "card", "link"...
  brand: string | null; // "visa", "mastercard"...
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  country: string | null; // País emisor de la tarjeta (señal de fraude RF-08.11: tarjeta vs. envío)
  isDefault: boolean;
}

// SetupIntentDto => client_secret para que Stripe Elements tokenice y guarde un método nuevo en el navegador
export interface SetupIntentDto {
  clientSecret: string;
}
