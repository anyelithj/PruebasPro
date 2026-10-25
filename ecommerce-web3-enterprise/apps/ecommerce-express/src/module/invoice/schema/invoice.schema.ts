// invoice.schema.ts => validación Zod del módulo Invoice.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

// BuyerSchema => datos fiscales del adquiriente (CC = cédula, NIT = empresa, CE = extranjería, PP = pasaporte)
export const BuyerSchema = z.object({
  documentType: z.enum(["CC", "NIT", "CE", "PP"]),
  documentNumber: z.string().regex(/^[0-9A-Za-z-]{5,20}$/),
  name: z.string().trim().min(2).max(200),
  email: z.string().email(),
});

// CreateInvoiceSchema => POST /api/v1/invoice ("generar factura electrónica y enviar a DIAN")
// "buyer" opcional: sin él se factura a consumidor final con los datos de la cuenta
export const CreateInvoiceSchema = z.object({ orderId: z.string().uuid(), buyer: BuyerSchema.optional() });

// ListInvoicesQuerySchema => "listar facturas con filtros de fecha"
export const ListInvoicesQuerySchema = PaginationQuerySchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// CreateCreditNoteSchema => POST /api/v1/invoice/:id/credit-note (documento inmutable)
export const CreateCreditNoteSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(5).max(300),
  refundId: z.string().uuid().optional(),
});

// ResolutionSchema => POST /api/v1/invoice/resolution (RF-11.3 resolución DIAN: prefijo, rango y vigencia)
export const ResolutionSchema = z
  .object({
    resolutionNumber: z.string().trim().regex(/^\d{6,30}$/, { message: "Número de resolución: solo dígitos" }),
    prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/),
    fromNumber: z.number().int().min(1),
    toNumber: z.number().int().min(1),
    technicalKey: z.string().trim().min(10).max(100),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date(),
  })
  .refine((value) => value.toNumber >= value.fromNumber, { message: "El rango final debe ser mayor o igual al inicial", path: ["toNumber"] })
  .refine((value) => value.validTo > value.validFrom, { message: "La vigencia final debe ser posterior a la inicial", path: ["validTo"] });
export const UpdateResolutionSchema = z.object({ isActive: z.boolean() });

// VoidInvoiceSchema => POST /api/v1/invoice/:id/void (RF-11.3 anulación con nota crédito total)
export const VoidInvoiceSchema = z.object({ reason: z.string().trim().min(5).max(300) });

// TaxReportQuerySchema => GET /api/v1/invoice/report?from=&to=&format=json|csv (RF-11.3 reporte tributario)
export const TaxReportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  format: z.enum(["json", "csv"]).default("json"),
});

export type ResolutionInput = z.infer<typeof ResolutionSchema>;
export type BuyerInput = z.infer<typeof BuyerSchema>;
