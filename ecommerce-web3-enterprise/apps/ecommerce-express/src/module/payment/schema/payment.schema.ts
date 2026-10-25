// payment.schema.ts => validación Zod del módulo Payment.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

// ProcessPaymentSchema => POST /api/v1/payment/process ("procesar pago con Stripe")
export const ProcessPaymentSchema = z.object({ checkoutSessionId: z.string().uuid() });

// OfflinePaymentSchema => POST /api/v1/payment/offline (RF-08.3 transferencia o contra entrega)
export const OfflinePaymentSchema = z.object({ checkoutSessionId: z.string().uuid(), method: z.enum(["BANK_TRANSFER", "CASH_ON_DELIVERY"]) });

// CryptoQuoteSchema => POST /api/v1/payment/crypto/quote (RF-08.9 cotización en BTC/ETH/USDT/USDC)
export const CryptoQuoteSchema = z.object({ checkoutSessionId: z.string().uuid(), asset: z.enum(["BTC", "ETH", "USDT", "USDC"]), network: z.enum(["bitcoin", "ethereum", "polygon"]) });

// CryptoConfirmSchema => POST /api/v1/payment/crypto/:id/confirm: hash EVM (0x + 64 hex) o txid de Bitcoin (64 hex)
export const CryptoConfirmSchema = z.object({ txHash: z.string().trim().regex(/^(0x)?[a-fA-F0-9]{64}$/, { message: "Hash de transacción inválido" }) });

// OneClickSchema => POST /api/v1/payment/one-click (RF-08.1): método y dirección predeterminados del usuario
export const OneClickSchema = z.object({
  returnUrl: z.string().url(), // A dónde vuelve Stripe tras 3-D Secure
  points: z.number().int().min(0).optional(),
  channel: z.enum(["WEB", "SOCIAL", "MARKETING"]).optional(),
  channelRef: z.string().trim().max(120).optional(),
});

// RefundPaymentSchema => POST /api/v1/payment/refund (ejecuta en Stripe una devolución APROBADA)
export const RefundPaymentSchema = z.object({ refundId: z.string().uuid() });

export const ListPaymentsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(["PENDING", "REQUIRES_ACTION", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
  provider: z.enum(["STRIPE", "MANUAL", "BANK_TRANSFER", "CASH_ON_DELIVERY", "CRYPTO"]).optional(), // RF-08.3
});

export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuerySchema>;

// PaymentMethodParamSchema => RF-02.3 ":methodId" debe tener la forma de un token de Stripe ("pm_" + alfanumérico)
export const PaymentMethodParamSchema = z.object({ methodId: z.string().regex(/^pm_[A-Za-z0-9]+$/, { message: "Método de pago inválido" }) });
