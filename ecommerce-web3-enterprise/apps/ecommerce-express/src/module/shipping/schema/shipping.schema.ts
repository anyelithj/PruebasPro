// shipping.schema.ts => validación Zod del módulo Shipping.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

const ShipmentStatusEnum = z.enum(["PENDING", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"]);

// ShippingRateSchema => POST /api/v1/shipping/rate: destino por dirección guardada O por datos explícitos
export const ShippingRateSchema = z.union([
  z.object({ addressId: z.string().uuid(), weightGrams: z.number().int().min(0), subtotalCents: z.number().int().min(0) }),
  z.object({
    destination: z.object({
      country: z.string().length(2).toUpperCase(),
      state: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().min(3),
    }),
    weightGrams: z.number().int().min(0),
    subtotalCents: z.number().int().min(0),
  }),
]);

// ShippingLabelSchema => POST /api/v1/shipping/label ("generar guía con transportadora")
export const ShippingLabelSchema = z.object({ shipmentId: z.string().uuid() });

// UpdateShippingSchema => PATCH parcial del estado con evento de rastreo
export const UpdateShippingSchema = z.object({
  status: ShipmentStatusEnum,
  description: z.string().trim().min(3).max(300).optional(),
  location: z.string().trim().max(120).optional(),
});

// AddressSuggestQuerySchema => GET /api/v1/shipping/address-suggest?q= (RF-08.2 autocompletado)
export const AddressSuggestQuerySchema = z.object({ q: z.string().trim().min(4).max(120) });

// CarrierStatsQuerySchema => GET /api/v1/shipping/stats?days= (RF-10.7)
export const CarrierStatsQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(365).default(90) });

export const ListShippingQuerySchema = PaginationQuerySchema.extend({ status: ShipmentStatusEnum.optional() });

export type ShippingRateInput = z.infer<typeof ShippingRateSchema>;
export type UpdateShippingInput = z.infer<typeof UpdateShippingSchema>;
