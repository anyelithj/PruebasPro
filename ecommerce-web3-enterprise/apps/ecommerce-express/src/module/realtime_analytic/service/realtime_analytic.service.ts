// realtime_analytic.service.ts (TypeScript + Mongoose) => analítica de alta frecuencia (sprint 9.1, reemplazo de Rust).
// - Buffer en memoria ORDENADO por tiempo con la última hora de eventos (tope de 50.000): las consultas agregan
//   al vuelo con búsqueda binaria (window.util) sin tocar la base => objetivo < 5 ms por consulta.
// - Persistencia por LOTES en MongoDB (insertMany cada 5 s o cada 500 eventos): una escritura por lote en vez de
//   una por evento (menos I/O, CPU y energía). Sin eventos no hay timers corriendo (nada que hacer en reposo).
// Patrones: Observer (onActivity avisa al gateway Socket.io), Strategy (tumbling | sliding | session),
// Buffer/Batch Write. Paradigma funcional en los agregados (funciones puras de window.util).
import { performance } from "node:perf_hooks";
import { logger } from "../../../shared/middleware/logger.middleware";
import { RealtimeAnalyticEventModel, type Dimension } from "../model/realtime_analytic.model";
import { lowerBound, session, sliding, summarize, tumbling, type TimedPoint } from "../util/window.util";
import type { CreateEventRequest, KpiSnapshot, MetricGroup, MetricQuery, MetricResponse } from "../dto/realtime_analytic.dto";
import { AnalyticError } from "../error/realtime_analytic.error";

const BUFFER_WINDOW_MS = 60 * 60_000; // La ventana más grande consultable (size_seconds máx. 3.600)
const MAX_BUFFER = 50_000; // ~150 bytes por evento => techo aproximado de 7,5 MB de RAM
const MAX_PENDING = 5_000; // Lote pendiente máximo si MongoDB no responde (protección de memoria)
const FLUSH_MS = 5_000;
const FLUSH_BATCH = 500;
const KPI_WINDOW_MS = 60_000;
const MAX_SESSION_GROUPS = 50; // La respuesta de "session" devuelve las 50 sesiones con más eventos
export const SPIKE_EVENTS_PER_MINUTE = 10_000; // Umbral de alerta por pico de tráfico

// BufferedEvent => evento en memoria (TimedPoint + datos para filtrar y agrupar). "readonly" => inmutable
interface BufferedEvent extends TimedPoint {
  readonly type: string;
  readonly userId: string | null;
  readonly dimensions: Readonly<Partial<Record<Dimension, string | undefined>>>;
}

type NewEventDoc = { type: string; value: number; userId: string | null; sessionId: string; dimensions: Partial<Record<Dimension, string | undefined>>; occurredAt: Date };

export class RealtimeAnalyticService {
  private buffer: BufferedEvent[] = [];
  private pending: NewEventDoc[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly listeners = new Set<() => void>();

  // onActivity => Observer: el gateway se entera de que hubo eventos (sin recibir cada uno: menos trabajo)
  public onActivity(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // record => POST /api/v1/rt/analytic/event — memoria primero, MongoDB después (por lotes)
  public record(input: CreateEventRequest, userId: string | null): { accepted: true; occurredAt: string } {
    if (this.pending.length >= MAX_PENDING) throw AnalyticError.bufferFull();
    const at = input.occurred_at?.getTime() ?? Date.now();
    const event: BufferedEvent = { at, value: input.value, sessionKey: input.session_id, type: input.type, userId, dimensions: input.dimensions };

    // Inserción ordenada: lo normal es anexar al final; un evento atrasado se inserta en su posición (búsqueda binaria)
    const last = this.buffer[this.buffer.length - 1];
    if (!last || last.at <= at) this.buffer.push(event);
    else this.buffer.splice(lowerBound(this.buffer, at + 1), 0, event);
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER); // Tope de RAM

    this.pending.push({ type: event.type, value: event.value, userId, sessionId: event.sessionKey, dimensions: { ...event.dimensions }, occurredAt: new Date(at) });
    if (this.pending.length >= FLUSH_BATCH) void this.flush();
    // "??=" => programa UN solo flush por ventana; ".unref()" => el timer no impide cerrar el proceso
    else this.flushTimer ??= setTimeout(() => void this.flush(), FLUSH_MS).unref();

    this.listeners.forEach((listener) => listener());
    return { accepted: true, occurredAt: new Date(at).toISOString() };
  }

  // metrics => GET /api/v1/rt/analytic/metric — agregación al vuelo, sin persistir intermedios
  public metrics(query: MetricQuery, now = Date.now()): MetricResponse {
    const started = performance.now();
    const sizeMs = query.size_seconds * 1000;
    const points = query.type ? this.buffer.filter((event) => event.type === query.type) : this.buffer;

    let inWindow: BufferedEvent[];
    let groups: MetricGroup[];
    // "switch" sobre un enum literal => Strategy por tipo de ventana (el compilador exige cubrir los 3 casos)
    switch (query.window) {
      case "tumbling": {
        const buckets = tumbling(points, sizeMs, now, query.buckets);
        inWindow = buckets.flatMap((bucket) => bucket.points);
        groups = buckets.map((bucket) => ({ key: bucket.start, ...summarize(bucket.points.map((event) => event.value)) }));
        break;
      }
      case "session": {
        inWindow = sliding(points, BUFFER_WINDOW_MS, now);
        groups = session(inWindow, query.gap_seconds * 1000)
          .sort((a, b) => b.points.length - a.points.length)
          .slice(0, MAX_SESSION_GROUPS)
          .map((group) => ({ key: `${group.key}@${new Date(group.start).toISOString()}`, ...summarize(group.points.map((event) => event.value)) }));
        break;
      }
      case "sliding":
        inWindow = sliding(points, sizeMs, now);
        groups = [];
        break;
    }

    if (query.dimension && query.window === "sliding") groups = groupByDimension(inWindow, query.dimension);
    return {
      window: query.window,
      sizeSeconds: query.size_seconds,
      type: query.type ?? null,
      dimension: query.dimension ?? null,
      total: summarize(inWindow.map((event) => event.value)),
      activeSessions: new Set(inWindow.map((event) => event.sessionKey)).size,
      groups,
      computedInMs: Number((performance.now() - started).toFixed(3)),
    };
  }

  // kpis => foto del último minuto para el panel en vivo (ventas, ingresos, sesiones activas, conversión)
  public kpis(now = Date.now()): KpiSnapshot {
    const minute = sliding(this.buffer, KPI_WINDOW_MS, now);
    const purchases = minute.filter((event) => event.type === "purchase");
    const sessions = new Set(minute.map((event) => event.sessionKey));
    const buyers = new Set(purchases.map((event) => event.sessionKey));
    return {
      at: new Date(now).toISOString(),
      eventsPerMinute: minute.length,
      salesCount: purchases.length,
      revenue: summarize(purchases.map((event) => event.value)).sum,
      activeSessions: sessions.size,
      conversionRate: sessions.size ? Number((buyers.size / sessions.size).toFixed(4)) : 0,
    };
  }

  // purgeExpired => DELETE /api/v1/rt/analytic/event-buffer — descarta eventos fuera de la ventana máxima
  public purgeExpired(now = Date.now()): { purged: number; remaining: number } {
    const cut = lowerBound(this.buffer, now - BUFFER_WINDOW_MS);
    this.buffer = this.buffer.slice(cut); // Nuevo arreglo: libera la memoria de los eventos viejos
    return { purged: cut, remaining: this.buffer.length };
  }

  // flush => escribe el lote pendiente en MongoDB (también al apagar el proceso: graceful shutdown)
  public async flush(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.pending.length === 0) return;
    const batch = this.pending.splice(0); // "splice(0)" => toma todo y vacía el arreglo original
    try {
      await RealtimeAnalyticEventModel.insertMany(batch, { ordered: false }); // "ordered: false" => un fallo no frena el resto
    } catch (error) {
      // MongoDB caído: se reintenta en el siguiente lote mientras quepa; si no cabe, se descarta (los agregados en
      // memoria siguen correctos; solo se pierde el histórico de ese lote)
      if (this.pending.length + batch.length <= MAX_PENDING) this.pending.unshift(...batch);
      else logger.warn("rt_analytic_batch_dropped", { events: batch.length });
      logger.error("rt_analytic_flush_failed", { error });
    }
  }
}

// groupByDimension => agregados por valor de dimensión (región, canal...), los 50 más activos primero
function groupByDimension(events: readonly BufferedEvent[], dimension: Dimension): MetricGroup[] {
  const groups = new Map<string, number[]>();
  for (const event of events) {
    const key = event.dimensions[dimension] ?? "(sin dato)";
    const values = groups.get(key) ?? [];
    values.push(event.value);
    groups.set(key, values);
  }
  return [...groups]
    .map(([key, values]) => ({ key, ...summarize(values) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SESSION_GROUPS);
}

// Singleton del módulo: un solo buffer por proceso
export const realtimeAnalyticService = new RealtimeAnalyticService();
