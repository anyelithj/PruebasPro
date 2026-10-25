// analytics.service.ts => analítica (sprint 7.1) con CQRS: el COMANDO (tracking) escribe eventos crudos en MongoDB;
// las CONSULTAS (métricas, embudo, reportes) leen agregados de PostgreSQL + MongoDB y se cachean en Redis 5 min
// (read model cacheado: un panel abierto por varios admins no repite agregaciones pesadas => ahorro de CPU/energía).
// Patrones: CQRS, Aggregate, Cache-Aside, Strategy (reporte por dimensión) y Observer (analytics.tracked => tiempo real).
import { analyticsRepository, periodKey, type AnalyticsRepository, type BehaviorPoint, type SalesPoint } from "../repository/analytics.repository";
import { analyticsEvents } from "../event/analytics.event";
import { InvalidRangeException } from "../exception/analytics.exception";
import { FUNNEL, type Granularity } from "../model/analytics.model";
import type { AnalyticEventDto, FunnelStepDto, MetricPointDto, MetricQueryDto, ReportDto, ReportRowDto, TrackEventDto } from "../dto/analytics.dto";
import type { EventInput, ListEventsQuery, MetricQuery, ReportQuery } from "../schema/analytics.schema";
import { cached } from "../../../shared/interceptor/cache.interceptor";
import { RedisKeys } from "../../../config/redis.config";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 1096; // RF-24.9 hasta 3 años (series por trimestre o año)
const REPORT_TTL_SECONDS = 300; // 5 minutos: suficiente para un panel; "realtime" lo salta

// ratio => división segura redondeada a 4 decimales (0 si no hay base)
export const ratio = (part: number, total: number): number => (total > 0 ? Number((part / total).toFixed(4)) : 0);

// resolveRange => período por defecto (últimos 30 días) y validación del tamaño máximo
export function resolveRange(query: { from?: Date | undefined; to?: Date | undefined }): { from: Date; to: Date } {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - 30 * DAY_MS);
  if (from > to || to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) throw new InvalidRangeException(MAX_RANGE_DAYS);
  return { from, to };
}

// mergeSeries => une ventas (PostgreSQL) y comportamiento (MongoDB) por período. Función PURA (testeable).
export function mergeSeries(sales: SalesPoint[], behavior: BehaviorPoint[]): MetricPointDto[] {
  const periods = [...new Set([...sales.map((point) => point.period), ...behavior.map((point) => point.period)])].sort();
  const salesBy = new Map(sales.map((point) => [point.period, point]));
  const behaviorBy = new Map(behavior.map((point) => [point.period, point]));
  return periods.map((period) => {
    const sale = salesBy.get(period);
    const seen = behaviorBy.get(period);
    const purchases = seen?.counts.purchase ?? 0;
    return {
      period,
      revenueCents: sale?.revenueCents ?? 0,
      orders: sale?.orders ?? 0,
      aovCents: sale && sale.orders > 0 ? Math.round(sale.revenueCents / sale.orders) : 0,
      sessions: seen?.sessions ?? 0,
      pageViews: seen?.counts.page_view ?? 0,
      addToCart: seen?.counts.add_to_cart ?? 0,
      purchases,
      conversionRate: ratio(purchases, seen?.sessions ?? 0),
    };
  });
}

export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  // createAnalyticEvent => "registrar evento de tracking analytics" (lote del navegador; userId lo fija el servidor)
  public async createAnalyticEvent(events: EventInput[], userId: string | null): Promise<TrackEventDto> {
    const accepted = await this.repository.insertMany(events.map((event) => ({ ...event, userId })));
    analyticsEvents.emit("analytics.tracked", { count: accepted });
    return { accepted };
  }

  // listAnalyticEvents => "eventos con filtros temporales"
  public async listAnalyticEvents(query: ListEventsQuery): Promise<{ items: AnalyticEventDto[]; meta: PaginationMeta }> {
    const { page: _page, limit: _limit, ...filters } = query;
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(filters, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // deleteAllAnalyticEvents => "limpiar eventos por período definido" (anteriores a "before")
  public async deleteAllAnalyticEvents(before: Date): Promise<{ deleted: number }> {
    return { deleted: await this.repository.deleteBefore(before) };
  }

  // listMetrics => "métricas agregadas por ventanas de tiempo" + totales + embudo + abandono de carrito
  public listMetrics(query: MetricQuery, fresh = false): Promise<MetricQueryDto> {
    const { from, to } = resolveRange(query);
    // RF-24.9 comparativo: el período inmediatamente anterior con la MISMA duración (ej. este mes vs. el anterior)
    const load = async (): Promise<MetricQueryDto> => {
      const current = await this.computeMetrics(from, to, query.granularity);
      if (!query.compare) return current;
      const span = to.getTime() - from.getTime();
      const previous = await this.computeMetrics(new Date(from.getTime() - span), from, query.granularity);
      return { ...current, previous: { from: previous.from, to: previous.to, series: previous.series, totals: previous.totals } };
    };
    return fresh ? load() : cached(RedisKeys.report("metric", `${periodKey(from)}:${periodKey(to)}:${query.granularity}:${query.compare ? "c" : ""}`), REPORT_TTL_SECONDS, load);
  }

  // listAnalyticReports => "reporte con dimensiones seleccionadas" (Strategy: ventas en SQL o comportamiento en Mongo)
  public listAnalyticReports(query: ReportQuery): Promise<ReportDto> {
    const { from, to } = resolveRange(query);
    return cached(RedisKeys.report(`report-${query.dimension}`, `${periodKey(from)}:${periodKey(to)}:${query.limit}`), REPORT_TTL_SECONDS, async () => ({
      dimension: query.dimension,
      from,
      to,
      rows: await this.reportRows(query.dimension, from, to, query.limit),
    }));
  }

  // conversion => tasa de conversión del período (sesiones con compra / sesiones) para el dashboard
  public async conversion(from: Date, to: Date): Promise<number> {
    const { sessions, purchaseSessions } = await this.repository.conversionTotals(from, to);
    return ratio(purchaseSessions, sessions);
  }

  public salesTotals(from: Date, to: Date) {
    return this.repository.salesTotals(from, to);
  }

  public async salesSeries(from: Date, to: Date, granularity: Granularity): Promise<MetricPointDto[]> {
    return mergeSeries(await this.repository.salesSeries(from, to, granularity), []);
  }

  private async computeMetrics(from: Date, to: Date, granularity: Granularity): Promise<MetricQueryDto> {
    // Las dos bases trabajan en paralelo (Promise.all): la respuesta tarda lo que la más lenta
    const [sales, behavior] = await Promise.all([this.repository.salesSeries(from, to, granularity), this.repository.behaviorSeries(from, to, granularity)]);
    const series = mergeSeries(sales, behavior);
    // "reduce" => suma cada campo numérico de la serie (los promedios y tasas se recalculan con los totales)
    const sum = (field: keyof Omit<MetricPointDto, "period">) => series.reduce((total, point) => total + point[field], 0);
    const counts = (type: (typeof FUNNEL)[number]) => behavior.reduce((total, point) => total + (point.counts[type] ?? 0), 0);
    const revenueCents = sum("revenueCents");
    const orders = sum("orders");
    const sessions = sum("sessions");
    const purchases = sum("purchases");
    const first = counts(FUNNEL[0] ?? "page_view");
    const funnel: FunnelStepDto[] = FUNNEL.map((step) => ({ step, count: counts(step), rate: ratio(counts(step), first) }));
    return {
      from,
      to,
      granularity,
      series,
      totals: { revenueCents, orders, aovCents: orders > 0 ? Math.round(revenueCents / orders) : 0, sessions, pageViews: sum("pageViews"), addToCart: sum("addToCart"), purchases, conversionRate: ratio(purchases, sessions) },
      funnel,
      cartAbandonmentRate: counts("add_to_cart") > 0 ? Number((1 - ratio(purchases, counts("add_to_cart"))).toFixed(4)) : 0,
    };
  }

  private async reportRows(dimension: ReportQuery["dimension"], from: Date, to: Date, limit: number): Promise<ReportRowDto[]> {
    if (dimension === "path" || dimension === "channel" || dimension === "event") return this.repository.behaviorReport(dimension, from, to, limit);
    const rows = await this.repository.salesReport(dimension, from, to, limit);
    if (dimension !== "product") return rows;
    // Productos: se agregan vistas y "agregar al carrito" (análisis views -> cart adds -> purchases -> revenue)
    const behavior = await this.repository.productBehavior(rows.map((row) => row.key), from, to);
    return rows.map((row) => ({ ...row, views: behavior.get(row.key)?.views ?? 0, addToCart: behavior.get(row.key)?.addToCart ?? 0 }));
  }
}

export const analyticsService = new AnalyticsService(analyticsRepository);
