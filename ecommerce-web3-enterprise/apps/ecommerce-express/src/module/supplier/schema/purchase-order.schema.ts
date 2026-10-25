// purchase-order.schema.ts => validación Zod de compras a proveedores (RF-23.3 / 23.5 / 23.6 / 23.8 / 23.9).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

const Units = z.number().int().min(0).max(1_000_000);
// Línea por id de variante o por SKU (el panel escribe SKU; el service lo resuelve)
const Item = z
  .object({ variantId: z.string().uuid().optional(), sku: z.string().trim().min(1).max(64).optional(), quantity: Units.min(1), unitCostCents: z.number().int().min(0).max(1_000_000_000) })
  .refine((item) => Boolean(item.variantId || item.sku), { message: "variantId o sku es obligatorio" });

// PurchaseOrderSchema => POST /supplier/purchase-order (borrador; "send: true" la envía de una vez por correo/WhatsApp)
export const PurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  items: z.array(Item).min(1).max(200),
  expectedAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  send: z.boolean().default(false),
});

// UpdatePurchaseOrderSchema => PATCH (solo en borrador): líneas, fecha esperada y notas
export const UpdatePurchaseOrderSchema = z.object({
  items: z.array(Item).min(1).max(200).optional(),
  expectedAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

// SendSchema => canales del envío automático (RF-23.9)
export const SendSchema = z.object({ channels: z.array(z.enum(["EMAIL", "WHATSAPP"])).min(1).default(["EMAIL", "WHATSAPP"]) });

// ReceiveSchema => recepción con control de calidad por línea (aceptadas entran al inventario; rechazadas no)
export const ReceiveSchema = z.object({
  items: z.array(z.object({ itemId: z.string().uuid(), accepted: Units, rejected: Units.default(0), qcNotes: z.string().trim().max(300).optional() })).min(1),
  warehouse: z.enum(["MAIN", "STORE", "CONSIGNMENT"]).default("MAIN"),
});

export const ListPurchaseOrdersQuerySchema = PaginationQuerySchema.extend({
  supplierId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"]).optional(),
  payable: z.enum(["open", "due", "overdue", "paid"]).optional(), // Cuentas por pagar
});
export const ValuationQuerySchema = z.object({ method: z.enum(["AVERAGE", "FIFO"]).default("AVERAGE"), limit: z.coerce.number().int().min(1).max(500).default(100) });
export const PriceComparisonQuerySchema = z.object({ variantId: z.string().uuid().optional(), q: z.string().trim().max(100).optional() });

export type PurchaseOrderInput = z.infer<typeof PurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;
export type ReceiveInput = z.infer<typeof ReceiveSchema>;
export type ListPurchaseOrdersQuery = z.infer<typeof ListPurchaseOrdersQuerySchema>;
