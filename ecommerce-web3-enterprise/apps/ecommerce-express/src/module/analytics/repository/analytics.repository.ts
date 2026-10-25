// analytics.repository.ts => lado de LECTURA (CQRS) y escritura de eventos. Ventas agregadas desde PostgreSQL (fuente
// de verdad, nunca duplicada) y comportamiento desde MongoDB. Las agregaciones las hace cada base (GROUP BY /
// $group): Node solo une resultados pequeños => menos CPU, RAM y transferencia.
import { Prisma, type PrismaClient } from "@prisma/client";
import type { FilterQuery } from "mongoose";
import { prisma } from "../../../config/database.config";
import { AnalyticEventModel, type AnalyticEventRecord, type EventType, type Granularity } from "../model/analytics.model";
import type { AnalyticEventDto, ReportRowDto } from "../dto/analytics.dto";
import type { EventInput, ListEventsQuery } from "../schema/analytics.schema";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export interface SalesPoint {
  period: string;
  orders: number;
  revenueCents: number;
}

export interface BehaviorPoint {
  period: string;
  sessions: number;
  counts: Partial<Record<EventType, number>>;
}

// periodKey => fecha -> "YYYY-MM-DD" (UTC): clave común para unir las series de PostgreSQL y MongoDB
export const periodKey = (date: Date): string => date.toISOString().slice(0, 10);

// Rango cerrado [from, to] reutilizado por todas las consultas de MongoDB
const inRange = (from: Date, to: Date) => ({ createdAt: { $gte: from, $lte: to } });

export class AnalyticsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  // --- Escritura (comando) ---

  // insertMany => lote del navegador en UNA escritura; "ordered: false" => un evento inválido no frena el resto
  public async insertMany(events: Array<EventInput & { userId: string | null }>): Promise<number> {
    return (await AnalyticEventModel.insertMany(events, { ordered: false })).length;
  }

  public async deleteBefore(before: Date): Promise<number> {
    return (await AnalyticEventModel.deleteMany({ createdAt: { $lt: before } })).deletedCount;
  }

  // --- Lectura (consultas) ---

  public async findMany(filters: Omit<ListEventsQuery, "page" | "limit">, page: PageParams): Promise<Paginated<AnalyticEventDto>> {
    const where: FilterQuery<AnalyticEventRecord> = {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.path ? { path: filters.path } : {}),
      ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) } } : {}),
    };
    const [docs, total] = await Promise.all([AnalyticEventModel.find(where).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), AnalyticEventModel.countDocuments(where)]);
    return { items: docs.map(toEvent), total };
  }

  // salesSeries => ingresos y pedidos por período (date_trunc de PostgreSQL); pedidos cancelados excluidos
  public async salesSeries(from: Date, to: Date, granularity: Granularity): Promise<SalesPoint[]> {
    const rows = await this.db.$queryRaw<Array<{ period: Date; orders: number; revenue: bigint }>>`
      SELECT date_trunc(${granularity}, "placedAt") AS period, COUNT(*)::int AS orders, COALESCE(SUM("totalCents"), 0)::bigint AS revenue
      FROM orders WHERE status <> 'CANCELLED' AND "placedAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1`;
    return rows.map((row) => ({ period: periodKey(row.period), orders: row.orders, revenueCents: Number(row.revenue) }));
  }

  // salesTotals => totales del período (KPIs del dashboard y comparativa con el período anterior)
  public async salesTotals(from: Date, to: Date): Promise<{ orders: number; revenueCents: number }> {
    const result = await this.db.order.aggregate({ _count: { _all: true }, _sum: { totalCents: true }, where: { status: { not: "CANCELLED" }, placedAt: { gte: from, lte: to } } });
    return { orders: result._count._all, revenueCents: result._sum.totalCents ?? 0 };
  }

  // behaviorSeries => conteo por tipo de evento y sesiones únicas por período ($dateTrunc de MongoDB 5+)
  // ponytail: "$addToSet" de sesiones en memoria del servidor de Mongo; con millones de eventos/día => HyperLogLog en Redis.
  public async behaviorSeries(from: Date, to: Date, granularity: Granularity): Promise<BehaviorPoint[]> {
    const rows = await AnalyticEventModel.aggregate<{ _id: Date; sessions: number; types: Array<{ type: EventType; count: number }> }>([
      { $match: inRange(from, to) },
      { $group: { _id: { period: { $dateTrunc: { date: "$createdAt", unit: granularity, startOfWeek: "monday" } }, type: "$type" }, count: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
      { $group: { _id: "$_id.period", types: { $push: { type: "$_id.type", count: "$count" } }, sessions: { $push: "$sessions" } } },
      // "$reduce + $setUnion" => sesiones únicas del período sumando todos los tipos de evento
      { $project: { types: 1, sessions: { $size: { $reduce: { input: "$sessions", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } } } } },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((row) => ({ period: periodKey(row._id), sessions: row.sessions, counts: Object.fromEntries(row.types.map((item) => [item.type, item.count])) }));
  }

  // conversionTotals => sesiones únicas y sesiones con compra del período (tasa de conversión del dashboard)
  public async conversionTotals(from: Date, to: Date): Promise<{ sessions: number; purchaseSessions: number }> {
    const [result] = await AnalyticEventModel.aggregate<{ sessions: number; purchaseSessions: number }>([
      { $match: inRange(from, to) },
      { $group: { _id: "$sessionId", purchased: { $max: { $cond: [{ $eq: ["$type", "purchase"] }, 1, 0] } } } },
      { $group: { _id: null, sessions: { $sum: 1 }, purchaseSessions: { $sum: "$purchased" } } },
    ]);
    return { sessions: result?.sessions ?? 0, purchaseSessions: result?.purchaseSessions ?? 0 };
  }

  // salesReport => ranking por producto, categoría o marca desde los pedidos (ingresos y unidades)
  public async salesReport(dimension: "product" | "category" | "brand", from: Date, to: Date, limit: number): Promise<ReportRowDto[]> {
    // Cada dimensión define su clave, etiqueta y JOIN (tabla de estrategias en SQL, sin if/else repetidos)
    const by = {
      product: { key: Prisma.sql`oi."productId"`, label: Prisma.sql`MAX(oi."productName")`, join: Prisma.empty },
      category: { key: Prisma.sql`c.id`, label: Prisma.sql`MAX(c.name)`, join: Prisma.sql`JOIN products p ON p.id = oi."productId" JOIN categories c ON c.id = p."categoryId"` },
      brand: { key: Prisma.sql`b.id`, label: Prisma.sql`MAX(b.name)`, join: Prisma.sql`JOIN products p ON p.id = oi."productId" JOIN brands b ON b.id = p."brandId"` },
    }[dimension];
    const rows = await this.db.$queryRaw<Array<{ key: string | null; label: string; revenue: bigint; units: bigint }>>`
      SELECT ${by.key} AS key, ${by.label} AS label, SUM(oi."totalCents")::bigint AS revenue, SUM(oi.quantity)::bigint AS units
      FROM order_items oi JOIN orders o ON o.id = oi."orderId" AND o.status <> 'CANCELLED' AND o."placedAt" BETWEEN ${from} AND ${to}
      ${by.join}
      GROUP BY 1 ORDER BY revenue DESC LIMIT ${limit}`;
    return rows.filter((row) => row.key).map((row) => ({ key: String(row.key), label: row.label, value: Number(row.revenue), units: Number(row.units) }));
  }

  // productBehavior => vistas y agregados al carrito de una lista de productos (complementa el ranking por producto)
  public async productBehavior(productIds: string[], from: Date, to: Date): Promise<Map<string, { views: number; addToCart: number }>> {
    if (productIds.length === 0) return new Map();
    const rows = await AnalyticEventModel.aggregate<{ _id: string; views: number; addToCart: number }>([
      { $match: { productId: { $in: productIds }, type: { $in: ["view_item", "add_to_cart"] }, ...inRange(from, to) } },
      { $group: { _id: "$productId", views: { $sum: { $cond: [{ $eq: ["$type", "view_item"] }, 1, 0] } }, addToCart: { $sum: { $cond: [{ $eq: ["$type", "add_to_cart"] }, 1, 0] } } } },
    ]);
    return new Map(rows.map((row) => [row._id, { views: row.views, addToCart: row.addToCart }]));
  }

  // behaviorReport => ranking por ruta (páginas más vistas), canal de origen o tipo de evento
  public async behaviorReport(dimension: "path" | "channel" | "event", from: Date, to: Date, limit: number): Promise<ReportRowDto[]> {
    const field = { path: "$path", channel: { $ifNull: ["$channel", "direct"] }, event: "$type" }[dimension];
    const match = dimension === "path" ? { type: "page_view", ...inRange(from, to) } : inRange(from, to);
    const rows = await AnalyticEventModel.aggregate<{ _id: string; count: number }>([{ $match: match }, { $group: { _id: field, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: limit }]);
    return rows.map((row) => ({ key: row._id, label: row._id, value: row.count }));
  }
}

function toEvent(doc: Partial<AnalyticEventRecord> & { _id: unknown; createdAt?: Date }): AnalyticEventDto {
  return {
    id: String(doc._id),
    type: (doc.type ?? "page_view") as EventType,
    sessionId: doc.sessionId ?? "",
    userId: doc.userId ?? null,
    path: doc.path ?? "",
    productId: doc.productId ?? null,
    value: doc.value ?? null,
    channel: doc.channel ?? null,
    referrer: doc.referrer ?? null,
    metadata: (doc.metadata ?? {}) as Record<string, unknown>,
    createdAt: doc.createdAt ?? new Date(),
  };
}

export const analyticsRepository = new AnalyticsRepository();
