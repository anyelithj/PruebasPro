// analytics.schema.ts => validación Zod del módulo Analytics (EventSchema, MetricQuerySchema, reportes y purga).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { EventTypes, Granularities } from "../model/analytics.model";
import { ALERT_METRICS, ATTRIBUTION_MODELS } from "../model/attribution.model";

const MAX_BATCH = 50; // El navegador agrupa eventos y los envía en lote (menos peticiones = menos energía)

// EventSchema => un evento de tracking (sin datos personales: sessionId anónimo; userId lo pone el servidor)
export const EventSchema = z.object({
  type: z.enum(EventTypes),
  sessionId: z.string().trim().min(8).max(64),
  path: z.string().trim().min(1).max(300),
  productId: z.string().uuid().optional(),
  value: z.number().int().min(0).max(10_000_000_000).optional(),
  channel: z.string().trim().toLowerCase().max(60).optional(),
  referrer: z.string().trim().max(300).optional(),
  metadata: z.record(z.unknown()).default({}).refine((value) => JSON.stringify(value).length <= 2_000, { message: "metadata máximo 2 KB" }),
});

// TrackSchema => POST /api/v1/analytic/event: un evento suelto o un lote { events: [...] } (siempre devuelve arreglo)
export const TrackSchema = z.union([EventSchema.transform((event) => [event]), z.object({ events: z.array(EventSchema).min(1).max(MAX_BATCH) }).transform((body) => body.events)]);

// RangeSchema => período común de métricas y reportes (por defecto los últimos 30 días)
const RangeSchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

// MetricQuerySchema => GET /api/v1/analytic/metric?from=&to=&granularity=day|week|month
// RF-24.9 "compare=true" => además devuelve el período anterior de la misma duración
export const MetricQuerySchema = RangeSchema.extend({ granularity: z.enum(Granularities).default("day"), compare: z.enum(["true", "false"]).optional().transform((value) => value === "true") });

// ReportQuerySchema => GET /api/v1/analytic/report?dimension=product|category|brand|path|channel|event
export const ReportQuerySchema = RangeSchema.extend({
  dimension: z.enum(["product", "category", "brand", "path", "channel", "event"]).default("product"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ListEventsQuerySchema => GET /api/v1/analytic/event (filtros temporales y por tipo/usuario/ruta)
export const ListEventsQuerySchema = PaginationQuerySchema.extend({
  type: z.enum(EventTypes).optional(),
  userId: z.string().uuid().optional(),
  path: z.string().trim().max(300).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// PurgeSchema => DELETE /api/v1/analytic/event?before=: borra eventos anteriores a la fecha (no futura)
export const PurgeSchema = z.object({ before: z.coerce.date().refine((date) => date.getTime() <= Date.now(), { message: "before no puede ser futura" }) });

export type EventInput = z.infer<typeof EventSchema>;
export type MetricQuery = z.infer<typeof MetricQuerySchema>;
export type ReportQuery = z.infer<typeof ReportQuerySchema>;
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;

// ---------- RF-22.9 / 24.6 / 24.8 / 24.10 / 24.11 / 24.12 ----------
export const HeatmapQuerySchema = RangeSchema.extend({ path: z.string().trim().min(1).max(300), device: z.enum(["mobile", "desktop"]).optional() });
export const AttributionQuerySchema = RangeSchema.extend({ model: z.enum(ATTRIBUTION_MODELS).default("LAST_CLICK") });
export const ExportQuerySchema = RangeSchema.extend({
  report: z.enum(["metric", "product", "category", "brand", "path", "channel", "event"]).default("metric"),
  granularity: z.enum(Granularities).default("day"),
});
export const AlertRuleSchema = z.object({
  name: z.string().trim().min(3).max(120),
  metric: z.enum(ALERT_METRICS),
  operator: z.enum(["LT", "GT"]),
  threshold: z.number(),
  cooldownMinutes: z.number().int().min(5).max(1440).default(60),
  active: z.boolean().default(true),
});
export const UpdateAlertRuleSchema = AlertRuleSchema.partial();
export const RangeQuerySchema = RangeSchema;
