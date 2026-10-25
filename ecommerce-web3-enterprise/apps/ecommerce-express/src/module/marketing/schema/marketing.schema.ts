// marketing.schema.ts => validación Zod del módulo Marketing (CampaignSchema, AudienceSchema).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { Audiences, CampaignStatuses, Channels } from "../model/marketing.model";

// AudienceSchema => a quién va la campaña: todos con opt-in o un segmento del CRM
export const AudienceSchema = z.union([z.enum(Audiences), z.string().regex(/^SEGMENT:[a-f0-9]{24}$/i).transform((value) => value as `SEGMENT:${string}`)]); // RF-22.2 segmento personalizado
// AbTestSchema => RF-21.4 variante B y reglas de la prueba (solo canal EMAIL)
const AbTestSchema = z.object({
  subjectB: z.string().trim().min(1).max(200),
  contentB: z.string().min(1).max(100_000).optional(),
  testPercent: z.number().int().min(10).max(50).default(20),
  metric: z.enum(["OPEN", "CLICK"]).default("OPEN"),
  waitHours: z.number().int().min(1).max(72).default(4),
});

// Fecha futura (programación): no se programan campañas en el pasado
const FutureDate = z.coerce.date().refine((date) => date.getTime() > Date.now(), { message: "La fecha debe ser futura" });

// CampaignSchema => POST /api/v1/marketing/campaign. "sendNow" => se envía de inmediato (202).
export const CampaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    channel: z.enum(Channels),
    audience: AudienceSchema.default("ALL"),
    subject: z.string().trim().min(1).max(200),
    content: z.string().min(1).max(100_000),
    templateId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    url: z.string().url().max(500).optional(),
    scheduledAt: FutureDate.optional(),
    sendNow: z.boolean().default(false),
    costCents: z.number().int().min(0).max(100_000_000_000).default(0), // RF-24.3
    abTest: AbTestSchema.optional(),
  })
  .refine((value) => !(value.sendNow && value.scheduledAt), { message: "Elige sendNow o scheduledAt, no ambos", path: ["scheduledAt"] })
  .refine((value) => !value.abTest || value.channel === "EMAIL", { message: "La prueba A/B es solo para correo", path: ["abTest"] });

// UpdateCampaignSchema => PATCH parcial: segmento, canal, contenido y/o programación ("scheduledAt: null" desprograma)
export const UpdateCampaignSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  channel: z.enum(Channels).optional(),
  audience: AudienceSchema.optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  content: z.string().min(1).max(100_000).optional(),
  url: z.string().url().max(500).nullable().optional(),
  scheduledAt: FutureDate.nullable().optional(),
  sendNow: z.boolean().optional(),
  costCents: z.number().int().min(0).max(100_000_000_000).optional(),
  abTest: AbTestSchema.nullable().optional(),
});

export const ListCampaignsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(CampaignStatuses).optional(),
  channel: z.enum(Channels).optional(),
});

export type CampaignInput = z.infer<typeof CampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>;
