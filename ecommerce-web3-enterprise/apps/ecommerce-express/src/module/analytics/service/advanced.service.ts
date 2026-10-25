// advanced.service.ts => analítica avanzada del panel (MongoDB + PostgreSQL):
//  - RF-24.6 exportar reportes y métricas a CSV       - RF-24.8 mapa de calor de clics y rendimiento (Web Vitals p75)
//  - RF-22.9 recorrido del cliente (customer journey)  - RF-24.11 atribución multitoque por modelo
//  - RF-24.10 alertas de métricas críticas (reglas + evaluación periódica + aviso en tiempo real)
//  - RF-24.12 analítica de pagos cripto por activo/red y transacciones blockchain
// Patrones: Facade + Strategy (modelos de atribución) + Observer (alertas a administradores y al panel en vivo).
import { Schema, model } from "mongoose";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { AnalyticEventModel } from "../model/analytics.model";
import { attribute, breaches, mergeCredit, type AlertMetric, type AttributionModel, type Touchpoint } from "../model/attribution.model";
import { percentile } from "../../../shared/util/stats.util";
import { notificationService } from "../../notification/service/notification.service";
import { analyticsEvents } from "../event/analytics.event";
import { Roles } from "../../../shared/constants/roles.constants";
import { NotFoundException } from "../../../shared/filter/http-exception.filter";

const DAY = 86_400_000;
const JOURNEY_WINDOW_MS = 30 * DAY;
const GRID = 40; // Mapa de calor: rejilla de 40 columnas (x en %) x filas de 40 px (y absoluta)

// ---------- RF-24.10 reglas de alerta ----------
const alertRuleSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    metric: { type: String, required: true },
    operator: { type: String, enum: ["LT", "GT"], required: true },
    threshold: { type: Number, required: true },
    active: { type: Boolean, default: true },
    cooldownMinutes: { type: Number, default: 60 }, // No repite la alerta antes de este tiempo
    lastValue: { type: Number, default: null },
    lastTriggeredAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);
export const MetricAlertRuleModel = model("MetricAlertRule", alertRuleSchema);

// csv => escapa celdas (comillas dobles y separadores) y une filas (función pura)
export const toCsv = (rows: Array<Record<string, unknown>>): string => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const cell = (value: unknown) => {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((key) => cell(row[key])).join(","))].join("\n");
};

export class AdvancedAnalyticsService {
  // ---------- RF-24.8 mapa de calor + rendimiento ----------
  // heatmap => clics agrupados en celdas (x en % del ancho, y en px) por ruta y tipo de pantalla
  public async heatmap(path: string, from: Date, to: Date, device?: "mobile" | "desktop") {
    const match = { type: "click", path, createdAt: { $gte: from, $lte: to }, "metadata.x": { $type: "number" }, ...(device ? { "metadata.device": device } : {}) };
    const cells = await AnalyticEventModel.aggregate<{ _id: { cx: number; cy: number }; count: number }>([
      { $match: match },
      { $group: { _id: { cx: { $floor: { $multiply: ["$metadata.x", GRID / 100] } }, cy: { $floor: { $divide: ["$metadata.y", 40] } } }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2000 },
    ]);
    const [pageHeight] = await AnalyticEventModel.aggregate<{ h: number }>([{ $match: match }, { $group: { _id: null, h: { $max: "$metadata.h" } } }]);
    const elements = await AnalyticEventModel.aggregate<{ _id: string; count: number }>([{ $match: { ...match, "metadata.el": { $type: "string" } } }, { $group: { _id: "$metadata.el", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]);
    return { path, columns: GRID, rowHeight: 40, pageHeight: pageHeight?.h ?? 0, cells: cells.map((c) => ({ x: c._id.cx, y: c._id.cy, count: c.count })), topElements: elements.map((e) => ({ element: e._id, clicks: e.count })) };
  }

  // performance => p75 de LCP, CLS, INP, TTFB y carga completa por ruta (umbrales "bueno" de Google)
  public async performance(from: Date, to: Date) {
    const rows = await AnalyticEventModel.aggregate<{ _id: string; lcp: number[]; cls: number[]; inp: number[]; ttfb: number[]; load: number[]; samples: number }>([
      { $match: { type: "web_vital", createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: "$path", lcp: { $push: "$metadata.lcp" }, cls: { $push: "$metadata.cls" }, inp: { $push: "$metadata.inp" }, ttfb: { $push: "$metadata.ttfb" }, load: { $push: "$metadata.load" }, samples: { $sum: 1 } } },
      { $sort: { samples: -1 } },
      { $limit: 50 },
    ]);
    const p75 = (values: unknown[]) => percentile(values.filter((v): v is number => typeof v === "number"), 0.75);
    return rows.map((row) => {
      const metrics = { lcp: p75(row.lcp), cls: Number(p75(row.cls).toFixed(3)), inp: p75(row.inp), ttfb: p75(row.ttfb), load: p75(row.load) };
      const good = metrics.lcp <= 2500 && metrics.cls <= 0.1 && metrics.inp <= 200;
      return { path: row._id, samples: row.samples, ...metrics, rating: good ? "GOOD" : metrics.lcp > 4000 || metrics.cls > 0.25 || metrics.inp > 500 ? "POOR" : "NEEDS_IMPROVEMENT" };
    });
  }

  // ---------- RF-22.9 recorrido del cliente ----------
  public async journey(userId: string) {
    const [events, orders] = await Promise.all([
      AnalyticEventModel.find({ userId, createdAt: { $gte: new Date(Date.now() - 90 * DAY) } }).sort({ createdAt: 1 }).limit(500).select({ type: 1, path: 1, channel: 1, productId: 1, value: 1, createdAt: 1, sessionId: 1 }).lean(),
      prisma.order.findMany({ where: { userId }, orderBy: { placedAt: "asc" }, take: 50, select: { id: true, orderNumber: true, totalCents: true, channel: true, channelRef: true, placedAt: true } }),
    ]);
    // Etapas del embudo por sesión: el panel muestra el recorrido como línea de tiempo agrupada
    const sessions = new Map<string, { sessionId: string; startedAt: Date; channel: string | null; steps: string[]; purchased: boolean }>();
    for (const event of events) {
      const session = sessions.get(event.sessionId) ?? { sessionId: event.sessionId, startedAt: event.createdAt ?? new Date(), channel: null, steps: [], purchased: false };
      if (event.channel && !session.channel) session.channel = event.channel;
      if (session.steps.at(-1) !== event.type) session.steps.push(event.type);
      if (event.type === "purchase") session.purchased = true;
      sessions.set(event.sessionId, session);
    }
    const touchpoints = [...sessions.values()].filter((s) => s.channel).map((s) => ({ channel: s.channel!, at: s.startedAt }));
    return { sessions: [...sessions.values()], orders, touchpoints, channels: [...new Set(touchpoints.map((t) => t.channel))] };
  }

  // ---------- RF-24.11 atribución multitoque ----------
  // attribution => para cada compra del período, toques (canales) del mismo usuario/sesión en los 30 días previos
  public async attribution(model: AttributionModel, from: Date, to: Date) {
    const purchases = await AnalyticEventModel.find({ type: "purchase", createdAt: { $gte: from, $lte: to } }).select({ userId: 1, sessionId: 1, value: 1, createdAt: 1 }).limit(5000).lean();
    if (purchases.length === 0) return { model, conversions: 0, channels: [] };
    const userIds = [...new Set(purchases.map((p) => p.userId).filter((id): id is string => Boolean(id)))];
    const sessionIds = [...new Set(purchases.map((p) => p.sessionId))];
    const touches = await AnalyticEventModel.find({
      channel: { $nin: [null, ""] },
      createdAt: { $gte: new Date(from.getTime() - JOURNEY_WINDOW_MS), $lte: to },
      $or: [{ userId: { $in: userIds } }, { sessionId: { $in: sessionIds } }],
    })
      .select({ userId: 1, sessionId: 1, channel: 1, createdAt: 1 })
      .lean();
    const credits = purchases.map((purchase) => {
      const at = purchase.createdAt ?? new Date();
      const points: Touchpoint[] = touches
        .filter((t) => (t.createdAt ?? at) <= at && (t.createdAt ?? at).getTime() >= at.getTime() - JOURNEY_WINDOW_MS && ((purchase.userId && t.userId === purchase.userId) || t.sessionId === purchase.sessionId))
        .map((t) => ({ channel: t.channel ?? "direct", at: t.createdAt ?? at }));
      return attribute(points, purchase.value ?? 0, model, at);
    });
    return { model, conversions: purchases.length, channels: mergeCredit(credits) };
  }

  // ---------- RF-24.12 cripto ----------
  public async crypto(from: Date, to: Date) {
    const [byAsset, totals, chain] = await Promise.all([
      prisma.$queryRaw<Array<{ asset: string; network: string; payments: number; succeeded: number; amountCents: bigint; cryptoAmount: number; avgConfirmSeconds: number | null }>>(Prisma.sql`
        SELECT details->>'asset' AS asset, details->>'network' AS network, COUNT(*)::int AS payments,
          COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::int AS succeeded,
          COALESCE(SUM("amountCents") FILTER (WHERE status = 'SUCCEEDED'), 0)::bigint AS "amountCents",
          COALESCE(SUM((details->>'amount')::numeric) FILTER (WHERE status = 'SUCCEEDED'), 0)::float AS "cryptoAmount",
          AVG(EXTRACT(EPOCH FROM ((details->>'confirmedAt')::timestamptz - "createdAt"))) FILTER (WHERE details ? 'confirmedAt')::float AS "avgConfirmSeconds"
        FROM payments WHERE provider = 'CRYPTO' AND "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY 1, 2 ORDER BY "amountCents" DESC`),
      prisma.$queryRaw<Array<{ all: number; crypto: number; allCents: bigint; cryptoCents: bigint }>>(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::int AS "all", COUNT(*) FILTER (WHERE status = 'SUCCEEDED' AND provider = 'CRYPTO')::int AS crypto,
          COALESCE(SUM("amountCents") FILTER (WHERE status = 'SUCCEEDED'), 0)::bigint AS "allCents",
          COALESCE(SUM("amountCents") FILTER (WHERE status = 'SUCCEEDED' AND provider = 'CRYPTO'), 0)::bigint AS "cryptoCents"
        FROM payments WHERE "createdAt" BETWEEN ${from} AND ${to}`),
      prisma.blockchainTx.groupBy({ by: ["chain", "status"], where: { createdAt: { gte: from, lte: to } }, _count: { _all: true } }),
    ]);
    const total = totals[0];
    return {
      byAsset: byAsset.map((row) => ({ ...row, amountCents: Number(row.amountCents), successRate: row.payments ? row.succeeded / row.payments : 0 })),
      share: { payments: total?.all ? (total.crypto ?? 0) / total.all : 0, revenue: Number(total?.allCents ?? 0) ? Number(total?.cryptoCents ?? 0) / Number(total?.allCents ?? 1) : 0, cryptoCents: Number(total?.cryptoCents ?? 0) },
      blockchain: chain.map((row) => ({ chain: row.chain, status: row.status, count: row._count._all })),
    };
  }

  // ---------- RF-24.10 alertas ----------
  public async rules() {
    return (await MetricAlertRuleModel.find().sort({ createdAt: -1 }).lean()).map(({ _id, ...row }) => ({ id: String(_id), ...row }));
  }
  public async createRule(input: { name: string; metric: AlertMetric; operator: "LT" | "GT"; threshold: number; cooldownMinutes: number; active: boolean }, userId: string) {
    const doc = await MetricAlertRuleModel.create({ ...input, createdBy: userId });
    return { id: String(doc._id), ...input };
  }
  public async updateRule(id: string, input: Record<string, unknown>) {
    const doc = await MetricAlertRuleModel.findByIdAndUpdate(id, { $set: Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) }, { new: true }).lean();
    if (!doc) throw new NotFoundException("MetricAlertRule", id);
    const { _id, ...row } = doc;
    return { id: String(_id), ...row };
  }
  public async deleteRule(id: string): Promise<void> {
    await MetricAlertRuleModel.deleteOne({ _id: id });
  }

  // metricValue => valor actual de cada métrica vigilada (Strategy por tabla)
  private async metricValue(metric: AlertMetric): Promise<number> {
    const hourAgo = new Date(Date.now() - 3_600_000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const value: Record<AlertMetric, () => Promise<number>> = {
      REVENUE_LAST_HOUR: async () => (await prisma.order.aggregate({ where: { placedAt: { gte: hourAgo }, status: { not: "CANCELLED" } }, _sum: { totalCents: true } }))._sum.totalCents ?? 0,
      ORDERS_LAST_HOUR: () => prisma.order.count({ where: { placedAt: { gte: hourAgo }, status: { not: "CANCELLED" } } }),
      PAYMENT_FAILURES_LAST_HOUR: () => prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: hourAgo } } }),
      CONVERSION_TODAY: async () => {
        const [sessions, buyers] = await Promise.all([AnalyticEventModel.distinct("sessionId", { createdAt: { gte: today } }), AnalyticEventModel.distinct("sessionId", { type: "purchase", createdAt: { gte: today } })]);
        return sessions.length ? (buyers.length / sessions.length) * 100 : 0; // En %
      },
      CART_ABANDONMENT_TODAY: async () => {
        const [carts, buyers] = await Promise.all([AnalyticEventModel.distinct("sessionId", { type: "add_to_cart", createdAt: { gte: today } }), AnalyticEventModel.distinct("sessionId", { type: "purchase", createdAt: { gte: today } })]);
        return carts.length ? (1 - buyers.length / carts.length) * 100 : 0;
      },
      LCP_P75_TODAY: async () => percentile((await AnalyticEventModel.find({ type: "web_vital", createdAt: { gte: today } }).select({ "metadata.lcp": 1 }).limit(5000).lean()).map((e) => Number((e.metadata as { lcp?: number } | undefined)?.lcp ?? NaN)).filter(Number.isFinite), 0.75),
    };
    return value[metric]();
  }

  // evaluateAlerts => job cada 5 min: evalúa las reglas activas; si se cumple y pasó el enfriamiento, avisa a los
  // administradores (bandeja + correo) y al panel en vivo (Socket.io "admin:live")
  public async evaluateAlerts(): Promise<number> {
    const rules = await MetricAlertRuleModel.find({ active: true }).lean();
    let fired = 0;
    for (const rule of rules) {
      const current = await this.metricValue(rule.metric as AlertMetric).catch(() => null);
      if (current === null) continue;
      const cooled = !rule.lastTriggeredAt || Date.now() - rule.lastTriggeredAt.getTime() > (rule.cooldownMinutes ?? 60) * 60_000;
      const fire = breaches(current, rule.operator as "LT" | "GT", rule.threshold) && cooled;
      await MetricAlertRuleModel.updateOne({ _id: rule._id }, { $set: { lastValue: current, ...(fire ? { lastTriggeredAt: new Date() } : {}) } });
      if (!fire) continue;
      fired += 1;
      const admins = await prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { name: Roles.ADMIN } } } }, select: { id: true } });
      const body = `${rule.metric} = ${Math.round(current * 100) / 100} (${rule.operator === "LT" ? "<" : ">"} ${rule.threshold})`;
      await notificationService.broadcast(admins.map((a) => a.id), { type: "SYSTEM", message: { title: `Alerta: ${rule.name}`, body }, url: "/dashboard/analytics?tab=alerts", channels: ["IN_APP", "EMAIL", "PUSH"] });
      analyticsEvents.emit("metric.alert", { ruleId: String(rule._id), name: rule.name, metric: rule.metric, value: current, threshold: rule.threshold });
    }
    return fired;
  }

  // ---------- RF-24.6 exportación ----------
  public exportCsv(rows: Array<Record<string, unknown>>): string {
    return toCsv(rows);
  }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();
