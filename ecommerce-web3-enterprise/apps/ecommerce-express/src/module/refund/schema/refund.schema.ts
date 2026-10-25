// refund.schema.ts => validación Zod del módulo Refund.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

// CreateRefundSchema => POST /api/v1/refund ("crear solicitud con motivo y evidencia")
export const CreateRefundSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(["DAMAGED", "WRONG_ITEM", "NOT_AS_DESCRIBED", "NOT_RECEIVED", "CHANGED_MIND", "OTHER"]),
  description: z.string().trim().min(10).max(2000),
  // Fotos subidas antes con POST /api/v1/media/upload (folder=refunds)
  evidenceUrls: z.array(z.string().url()).max(6).default([]),
  // Monto parcial opcional; por defecto, el total pendiente de reembolso del pedido
  amountCents: z.number().int().positive().optional(),
  // RF-12.4 cómo resolver: reembolso al medio original, cambio por otra talla/color o crédito en tienda
  resolution: z.enum(["REFUND", "EXCHANGE", "STORE_CREDIT"]).default("REFUND"),
  exchangeVariantId: z.string().uuid().optional(), // Obligatorio para EXCHANGE (lo valida el service)
  // RF-12.5 unidades que vuelven (null = todo el pedido)
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).max(50).optional(),
});

// ReturnStatusSchema => PATCH /api/v1/refund/:id/return (RF-12.2 seguimiento de la logística inversa)
export const ReturnStatusSchema = z.object({ status: z.enum(["IN_TRANSIT", "RECEIVED"]) });

// InspectionSchema => POST /api/v1/refund/:id/inspection (RF-12.7 inspección de calidad al recibir)
export const InspectionSchema = z.object({
  passed: z.boolean(),
  notes: z.string().trim().min(3).max(1000),
  photoUrls: z.array(z.string().url()).min(1, { message: "Adjunta al menos una foto de la inspección" }).max(6),
});

export const RefundStatsQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(365).default(90) });

// ReviewRefundSchema => PATCH /api/v1/refund/:id/approve ("aprobar y activar reembolso")
export const ReviewRefundSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const ListRefundsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "PROCESSED", "CANCELLED"]).optional(),
});

export type CreateRefundInput = z.infer<typeof CreateRefundSchema>;
export type InspectionInput = z.infer<typeof InspectionSchema>;
