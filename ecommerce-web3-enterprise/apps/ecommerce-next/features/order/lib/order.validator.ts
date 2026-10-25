// order.validator.ts => formularios del detalle de pedido: cancelación y solicitud de devolución.
import { z } from "zod";

// Motivos de devolución (texto visible en messages/*.json -> order.refundReasons.<value>)
export const REFUND_REASONS = ["DAMAGED", "WRONG_ITEM", "NOT_AS_DESCRIBED", "NOT_RECEIVED", "CHANGED_MIND", "OTHER"] as const;

export const cancelSchema = z.object({ reason: z.string().trim().min(3, "validation.cancelReason").max(500) });

export const REFUND_RESOLUTIONS = ["REFUND", "EXCHANGE", "STORE_CREDIT"] as const; // RF-12.4

export const refundSchema = z.object({
  reason: z.enum(REFUND_REASONS),
  description: z.string().trim().min(10, "validation.refundDescription").max(2000),
  evidenceUrls: z.array(z.string().url()).max(6).default([]), // RF-12.7 fotos subidas a /media/upload (folder=refunds)
  resolution: z.enum(REFUND_RESOLUTIONS).default("REFUND"),
  exchangeVariantId: z.string().optional(), // Obligatorio si la resolución es EXCHANGE (lo valida Express)
});

export type CancelFormValues = z.infer<typeof cancelSchema>;
export type RefundFormValues = z.infer<typeof refundSchema>;
