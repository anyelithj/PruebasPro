// email.schema.ts => validación Zod del módulo Email (SendEmailSchema, TemplateSchema, filtros del historial).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { EmailStatuses } from "../model/email.model";
import { BlockSchema } from "../util/blocks.util";

const ObjectId = z.string().regex(/^[a-f0-9]{24}$/i, { message: "ID inválido" });
const MAX_RECIPIENTS = 100; // Tope por petición: los envíos masivos grandes van por Marketing (campañas por segmento)

// Variables de plantilla: valores simples (texto o número), acotados
const Variables = z.record(z.union([z.string().max(1_000), z.number()])).default({});

// SendEmailSchema => POST /api/v1/email/send: con plantilla guardada (templateId) o contenido directo (subject + html)
export const SendEmailSchema = z
  .object({
    // "union + transform" => acepta un email o una lista y siempre entrega string[] sin duplicados
    to: z
      .union([z.string().email(), z.array(z.string().email()).min(1).max(MAX_RECIPIENTS)])
      .transform((value) => [...new Set((Array.isArray(value) ? value : [value]).map((email) => email.toLowerCase()))]),
    templateId: ObjectId.optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    html: z.string().min(1).max(100_000).optional(),
    text: z.string().max(50_000).optional(),
    variables: Variables,
  })
  .refine((value) => value.templateId !== undefined || (value.subject !== undefined && value.html !== undefined), {
    message: "Envía templateId o subject + html",
    path: ["templateId"],
  });

// TemplateSchema => POST /api/v1/email/template (las variables se detectan del contenido, no se envían)
// RF-21.6 con "blocks" (diseñador visual) el HTML se genera en el servidor; sin bloques se exige "html"
const TemplateFields = z.object({
  name: z.string().trim().min(3).max(120),
  subject: z.string().trim().min(1).max(200),
  html: z.string().min(1).max(100_000).optional(),
  blocks: z.array(BlockSchema).min(1).max(60).optional(),
  text: z.string().max(50_000).optional(),
  locale: z.enum(["es", "en"]).default("es"),
});
export const TemplateSchema = TemplateFields.refine((value) => Boolean(value.html || value.blocks), { message: "html o blocks es obligatorio", path: ["html"] });

export const UpdateTemplateSchema = TemplateFields.partial();
// ClickQuerySchema => GET /email/:id/click?u=&s= (destino + firma)
export const ClickQuerySchema = z.object({ u: z.string().url().max(2000), s: z.string().min(10).max(64) });

// ListEmailsQuerySchema => GET /api/v1/email?status=&to=&campaignId=&page=
export const ListEmailsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(EmailStatuses).optional(),
  to: z.string().trim().toLowerCase().max(200).optional(),
  campaignId: ObjectId.optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;
export type TemplateInput = z.infer<typeof TemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type ListEmailsQuery = z.infer<typeof ListEmailsQuerySchema>;
// PreviewSchema => POST /email/template/preview (RF-21.6 vista previa del diseñador con datos de ejemplo)
export const PreviewSchema = z.object({ blocks: z.array(BlockSchema).min(1).max(60), variables: Variables, locale: z.enum(["es", "en"]).default("es") });
