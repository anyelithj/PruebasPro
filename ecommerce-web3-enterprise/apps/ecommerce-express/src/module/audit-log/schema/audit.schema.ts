// audit.schema.ts => validación Zod del módulo Audit Logs (AuditEventSchema, RetentionSchema, filtros y reporte).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { AuditSeverities, AuditSources } from "../model/audit.model";

// AuditEventSchema => POST /audit/log: registro de servicios externos (n8n, FastAPI) en el mismo audit trail
export const AuditEventSchema = z.object({
  action: z.string().trim().min(3).max(200),
  module: z.string().trim().min(2).max(60),
  resourceId: z.string().trim().max(100).optional(),
  severity: z.enum(AuditSeverities).default("INFO"),
  // "refine" => metadatos acotados a 5 KB: el audit trail no es un almacén de payloads
  metadata: z.record(z.unknown()).default({}).refine((value) => JSON.stringify(value).length <= 5_000, { message: "metadata máximo 5 KB" }),
});

// ListAuditQuerySchema => GET /audit/log con filtros avanzados (fecha, actor, acción, módulo, severidad, revisado)
export const ListAuditQuerySchema = PaginationQuerySchema.extend({
  actorId: z.string().trim().max(100).optional(),
  module: z.string().trim().max(60).optional(),
  action: z.string().trim().max(200).optional(), // Búsqueda parcial (sin distinguir mayúsculas)
  ip: z.string().trim().max(45).optional(), // RF-30.2 filtro por IP (IPv4/IPv6 exacta)
  q: z.string().trim().min(2).max(120).optional(), // RF-30.6 texto completo (índice "text" de MongoDB)
  source: z.enum(AuditSources).optional(), // RF-30.6 registros reunidos de varios servicios (HTTP, eventos, externos)
  severity: z.enum(AuditSeverities).optional(),
  reviewed: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ExportQuerySchema => RF-30.3 GET /audit/log/export: mismos filtros + formato; tope de 5.000 filas por archivo
export const ExportQuerySchema = ListAuditQuerySchema.omit({ page: true, limit: true }).extend({
  format: z.enum(["csv", "pdf"]).default("csv"),
  max: z.coerce.number().int().min(1).max(5000).default(5000),
});

// ReviewSchema => PATCH /audit/log/:id: solo se puede marcar como revisado (el resto del log es inmutable)
export const ReviewSchema = z.object({ reviewed: z.boolean().default(true) });

// RetentionSchema => DELETE /audit/log: purga manual de logs más viejos que N días (mínimo 30: protección)
export const RetentionSchema = z.object({ olderThanDays: z.coerce.number().int().min(30).max(3650) });

// ReportQuerySchema => GET /audit/report: período (por defecto los últimos 30 días)
export const ReportQuerySchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

export type AuditEventInput = z.infer<typeof AuditEventSchema>;
export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;
export type ReportQuery = z.infer<typeof ReportQuerySchema>;
export type ExportQuery = z.infer<typeof ExportQuerySchema>;
