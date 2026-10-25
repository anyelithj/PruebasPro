// crm.schema.ts => validación Zod del módulo CRM (CustomerSchema, SegmentSchema, ScoringSchema).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { queryBoolean } from "../../../shared/pipe/transform.pipe";
import { Segments } from "../model/crm.model";
import { SegmentRulesSchema } from "../model/insight.model";

const Tag = z.string().trim().toLowerCase().min(1).max(30);

// SegmentSchema => segmento automático por el que se filtra (o se elige la audiencia de una campaña)
export const SegmentSchema = z.enum(Segments);

// ScoringSchema => puntaje manual 0..100; null vuelve al automático (RFM)
export const ScoringSchema = z.number().int().min(0).max(100).nullable();

// CustomerSchema => POST /api/v1/crm/customer: cliente registrado por el equipo (tienda física, teléfono)
export const CustomerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(20).optional(),
  tags: z.array(Tag).max(20).default([]),
  note: z.string().trim().min(1).max(1_000).optional(),
});

// UpdateCustomerSchema => PATCH parcial: datos de contacto, etiquetas (reemplazo), nota nueva (se agrega) y scoring
export const UpdateCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  tags: z.array(Tag).max(20).optional(),
  note: z.string().trim().min(1).max(1_000).optional(),
  score: ScoringSchema.optional(),
});

// ListCustomersQuerySchema => GET /api/v1/crm/customer?q=&segment=&tag=&archived=&page=
export const ListCustomersQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(), // Nombre o email
  segment: SegmentSchema.optional(),
  tag: Tag.optional(),
  archived: queryBoolean, // true => solo archivados
});

export type CustomerInput = z.infer<typeof CustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;

// ChurnQuerySchema => GET /api/v1/crm/churn (RF-18.8): nivel mínimo de riesgo y cantidad
export const ChurnQuerySchema = z.object({
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// ---------- RF-22.2 / 22.4 / 22.6 / 22.7 ----------
export const CustomSegmentSchema = z.object({ name: z.string().trim().min(3).max(80), description: z.string().trim().max(300).optional(), rules: SegmentRulesSchema });
export const UpdateCustomSegmentSchema = z.object({ name: z.string().trim().min(3).max(80).optional(), description: z.string().trim().max(300).optional(), rules: SegmentRulesSchema.optional() });
export const SegmentPreviewSchema = z.object({ rules: SegmentRulesSchema });
export const MergeSchema = z.object({ primaryId: z.string().uuid(), duplicateId: z.string().uuid() });
export const ImportCsvSchema = z.object({ csv: z.string().min(10).max(2_000_000) }); // ~2 MB de texto
export const CohortQuerySchema = z.object({ months: z.coerce.number().int().min(2).max(36).default(12) });
