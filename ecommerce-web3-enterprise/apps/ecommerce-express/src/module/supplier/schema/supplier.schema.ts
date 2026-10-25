// supplier.schema.ts => validación Zod del módulo Suppliers (SupplierSchema, ContractSchema, filtros).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { queryBoolean } from "../../../shared/pipe/transform.pipe";

// ContractSchema => condiciones comerciales y contrato (se reutiliza dentro de SupplierSchema: composición)
export const ContractSchema = z.object({
  currency: z.string().length(3).toUpperCase().default("COP"),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  leadTimeDays: z.number().int().min(0).max(365).default(7),
  contractUrl: z.string().url().optional(),
  contractEndsAt: z.coerce.date().optional(),
});

// SupplierSchema => POST /api/v1/supplier
export const SupplierSchema = ContractSchema.extend({
  name: z.string().trim().min(2).max(150),
  taxId: z.string().trim().regex(/^[0-9A-Za-z.-]{5,20}$/, { message: "NIT inválido" }),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(20).optional(),
  contactName: z.string().trim().max(120).optional(),
  address: z.string().trim().max(250).optional(),
  country: z.string().length(2).toUpperCase().default("CO"),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

// UpdateSupplierSchema => PATCH parcial: ".partial()" vuelve opcionales todos los campos; "isActive" reactiva
export const UpdateSupplierSchema = SupplierSchema.partial().extend({ isActive: z.boolean().optional() });

// ListSuppliersQuerySchema => GET /api/v1/supplier?q=&active=&page= (ranking: mejor evaluación primero)
export const ListSuppliersQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  active: queryBoolean,
});

export type SupplierInput = z.infer<typeof SupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof ListSuppliersQuerySchema>;
