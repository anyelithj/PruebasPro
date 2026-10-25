// analytics.dto.ts => contratos de salida del módulo Analytics (TrackEventDto, MetricQueryDto, ReportDto).
import type { EventType, Granularity } from "../model/analytics.model";

// TrackEventDto => respuesta del tracking (solo cuántos se aceptaron: el navegador no necesita más)
export interface TrackEventDto {
  accepted: number;
}

export interface AnalyticEventDto {
  id: string;
  type: EventType;
  sessionId: string;
  userId: string | null;
  path: string;
  productId: string | null;
  value: number | null;
  channel: string | null;
  referrer: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// MetricPointDto => un punto de la serie temporal (ventas de PostgreSQL + comportamiento de MongoDB)
export interface MetricPointDto {
  period: string; // Inicio del período en ISO (YYYY-MM-DD)
  revenueCents: number;
  orders: number;
  aovCents: number; // Ticket promedio
  sessions: number;
  pageViews: number;
  addToCart: number;
  purchases: number;
  conversionRate: number; // purchases / sessions
}

export interface FunnelStepDto {
  step: EventType;
  count: number;
  rate: number; // Respecto al primer paso del embudo
}

// MetricQueryDto => GET /analytic/metric: serie + totales + embudo del período
export interface MetricQueryDto {
  from: Date;
  to: Date;
  granularity: Granularity;
  series: MetricPointDto[];
  totals: Omit<MetricPointDto, "period">;
  funnel: FunnelStepDto[];
  cartAbandonmentRate: number; // 1 - compras / carritos (análisis de abandono)
  previous?: { from: Date; to: Date; series: MetricPointDto[]; totals: MetricQueryDto["totals"] }; // RF-24.9 período anterior (comparativo)
}

export interface ReportRowDto {
  key: string;
  label: string;
  value: number; // Métrica principal (ingresos o conteo)
  units?: number;
  views?: number;
  addToCart?: number;
}

// ReportDto => GET /analytic/report: ranking por la dimensión elegida
export interface ReportDto {
  dimension: string;
  from: Date;
  to: Date;
  rows: ReportRowDto[];
}
