// realtime_analytic.dto.ts (Zod + TypeScript) => CreateEventRequest, MetricQuery y MetricResponse.
// Patrón DTO + validación declarativa: el schema valida en runtime y "z.infer" deriva el tipo (DRY).
import { z } from "zod";
import { Dimensions, type Dimension } from "../model/realtime_analytic.model";
import type { Summary } from "../util/window.util";

const Token = z.string().trim().min(1).max(64); // Identificadores cortos (ids, regiones, canales)

// CreateEventRequest => POST /api/v1/rt/analytic/event (snake_case como el resto de la Fase 9)
export const CreateEventRequestSchema = z.object({
  type: z.string().regex(/^[a-z][a-z0-9_.]{1,39}$/, { message: "type: minúsculas, dígitos, _ y . (2-40)" }),
  value: z.coerce.number().min(0).max(1e12).default(1),
  session_id: Token,
  dimensions: z.object({ product: Token, category: Token, region: Token, channel: Token }).partial().default({}),
  // Eventos de hasta 5 minutos atrás (reintentos del cliente); nunca del futuro
  occurred_at: z.coerce
    .date()
    .refine((date) => date.getTime() <= Date.now() + 5_000 && date.getTime() >= Date.now() - 5 * 60_000, { message: "occurred_at fuera de rango" })
    .optional(),
});
export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;

// MetricQuery => GET /api/v1/rt/analytic/metric?window=sliding&size_seconds=60&type=purchase&dimension=region
export const Windows = ["tumbling", "sliding", "session"] as const;
export const MetricQuerySchema = z.object({
  window: z.enum(Windows).default("sliding"),
  size_seconds: z.coerce.number().int().min(1).max(3_600).default(60),
  buckets: z.coerce.number().int().min(1).max(60).default(10), // Solo tumbling
  gap_seconds: z.coerce.number().int().min(10).max(3_600).default(1_800), // Solo session
  type: z.string().max(40).optional(),
  dimension: z.enum(Dimensions).optional(),
});
export type MetricQuery = z.infer<typeof MetricQuerySchema>;

// MetricGroup => agregado de un grupo (bucket, sesión o valor de dimensión)
export interface MetricGroup extends Summary {
  readonly key: string;
}

// MetricResponse => respuesta del endpoint de métricas
export interface MetricResponse {
  readonly window: (typeof Windows)[number];
  readonly sizeSeconds: number;
  readonly type: string | null;
  readonly dimension: Dimension | null;
  readonly total: Summary;
  readonly activeSessions: number;
  readonly groups: MetricGroup[];
  readonly computedInMs: number;
}

// KpiSnapshot => lo que se empuja por Socket.io (/rt/analytic) a los administradores conectados
export interface KpiSnapshot {
  readonly at: string;
  readonly eventsPerMinute: number;
  readonly salesCount: number;
  readonly revenue: number;
  readonly activeSessions: number;
  readonly conversionRate: number; // Sesiones con compra / sesiones activas (último minuto)
}
