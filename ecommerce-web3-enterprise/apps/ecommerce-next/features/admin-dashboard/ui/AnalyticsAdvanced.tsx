// AnalyticsAdvanced.tsx (Client Component · React + Canvas nativo + TanStack Query + Tailwind) => analítica avanzada:
//  - HeatmapTab: RF-24.8 mapa de calor de clics por página (canvas) + rendimiento (Core Web Vitals p75 por ruta)
//  - AttributionTab: RF-24.11 atribución multitoque por modelo (primer clic, último clic, lineal, decaimiento, posición)
//  - CryptoTab: RF-24.12 pagos cripto por activo/red y transacciones blockchain
//  - AlertsTab: RF-24.10 reglas de alerta de métricas críticas (CRUD) con último valor medido
//  - SimulationTab: RF-24.14 simulación del impacto de promociones y eventos (FastAPI)
//  - ExportButton: RF-24.6 descarga de reportes en CSV
// Patrones: Composite + Strategy (modelo de atribución) + Command. Accesibilidad: canvas con descripción y tabla de
// elementos más clicados como alternativa textual; tablas con caption.
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { downloadAuthed, useAdminGet, useAdminMutation } from "../api/dashboard.api";
import { AdminResource, toOptions } from "./AdminResource";
import { DataTable } from "./DataTable";
import { KPICard } from "./KPICard";
import { SectionHeader, SelectField } from "./AdminFields";
import { StatusBadge } from "./OrdersAdmin";
import { rangeToDates, useAdminDashboard } from "../model/dashboard.store";
import { LLM_ADMIN } from "@/features/ai-chat/api/llm-admin.api";
import { useAuth } from "@/shared/hook/useAuth";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { Button } from "@/shared/ui/Button";
import { toast } from "@/shared/ui/Toast";

const pct = (value: number) => `${(value * 100).toFixed(1)} %`;

// ---------- RF-24.6 exportar ----------
export function ExportButton({ report, granularity }: { report: string; granularity: string }) {
  const t = useTranslations("admin.analytics");
  const { accessToken } = useAuth();
  const { range } = useAdminDashboard();
  const { from } = rangeToDates(range);
  return (
    <Button size="sm" variant="secondary" onClick={() => accessToken && downloadAuthed(`/analytic/export?report=${report}&granularity=${granularity}&from=${from}`, `reporte-${report}.csv`, accessToken).catch(() => toast.error(t("downloadError")))}>
      {t("exportCsv")}
    </Button>
  );
}

// ---------- RF-24.8 mapa de calor + rendimiento ----------
interface Heatmap {
  columns: number;
  rowHeight: number;
  pageHeight: number;
  cells: Array<{ x: number; y: number; count: number }>;
  topElements: Array<{ element: string; clicks: number }>;
}
export function HeatmapTab() {
  const t = useTranslations("admin.analytics");
  const { range } = useAdminDashboard();
  const dates = rangeToDates(range);
  const [path, setPath] = useState("/");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const heat = useAdminGet<Heatmap>("heatmap", "/analytic/heatmap", { ...dates, path, device });
  const perf = useAdminGet<Array<{ path: string; samples: number; lcp: number; cls: number; inp: number; ttfb: number; load: number; rating: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" }>>("performance", "/analytic/performance", dates);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Dibujo: cada celda es un rectángulo con opacidad proporcional a sus clics (escala de calor azul -> rojo)
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    const data = heat.data;
    if (!ctx || !canvas.current || !data) return;
    const width = canvas.current.width;
    const rows = Math.max(1, Math.ceil((data.pageHeight || 2000) / data.rowHeight));
    canvas.current.height = Math.min(1600, rows * 12);
    const cellW = width / data.columns;
    const cellH = canvas.current.height / rows;
    const max = Math.max(1, ...data.cells.map((c) => c.count));
    ctx.clearRect(0, 0, width, canvas.current.height);
    for (const cell of data.cells) {
      const intensity = cell.count / max;
      ctx.fillStyle = `hsla(${(1 - intensity) * 240}, 90%, 50%, ${0.25 + intensity * 0.65})`;
      ctx.fillRect(cell.x * cellW, cell.y * cellH, cellW, cellH);
    }
  }, [heat.data]);

  const RATING = { GOOD: "APPROVED", NEEDS_IMPROVEMENT: "PENDING", POOR: "FAILED" } as const;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeader
          title={t("heatmap")}
          description={t("heatmapHint")}
          actions={
            <>
              <label className="flex flex-col gap-1 text-sm">{t("page")}<input value={path} onChange={(e) => setPath(e.target.value || "/")} className="h-9 rounded-md border px-2" /></label>
              <SelectField label={t("device")} value={device} onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")} options={[{ value: "desktop", label: t("devices.desktop") }, { value: "mobile", label: t("devices.mobile") }]} />
            </>
          }
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <canvas ref={canvas} width={device === "mobile" ? 390 : 960} role="img" aria-label={t("heatmapAria", { clicks: heat.data?.cells.reduce((s, c) => s + c.count, 0) ?? 0, path })} className="w-full max-w-full rounded-lg border bg-slate-50" />
          <DataTable caption={t("topElements")} rows={heat.data?.topElements} rowKey={(row) => row.element} columns={[{ key: "el", header: t("element"), cell: (row) => <code className="text-xs">{row.element}</code> }, { key: "clicks", header: t("clicks"), cell: (row) => row.clicks, className: "text-right tabular-nums" }]} />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeader title={t("performance")} description={t("performanceHint")} />
        <DataTable
          caption={t("performance")}
          rows={perf.data}
          loading={perf.isLoading}
          rowKey={(row) => row.path}
          columns={[
            { key: "path", header: t("page"), cell: (row) => <code className="text-xs">{row.path}</code> },
            { key: "lcp", header: "LCP", cell: (row) => `${(row.lcp / 1000).toFixed(2)} s`, className: "text-right tabular-nums" },
            { key: "cls", header: "CLS", cell: (row) => row.cls, className: "text-right tabular-nums" },
            { key: "inp", header: "INP", cell: (row) => `${row.inp} ms`, className: "text-right tabular-nums" },
            { key: "load", header: t("load"), cell: (row) => `${(row.load / 1000).toFixed(2)} s`, className: "text-right tabular-nums" },
            { key: "samples", header: t("samples"), cell: (row) => row.samples, className: "text-right tabular-nums" },
            { key: "rating", header: t("rating"), cell: (row) => <StatusBadge status={RATING[row.rating]} label={t(`ratings.${row.rating}`)} /> },
          ]}
        />
      </section>
    </div>
  );
}

// ---------- RF-24.11 atribución ----------
const MODELS = ["LAST_CLICK", "FIRST_CLICK", "LINEAR", "TIME_DECAY", "POSITION_BASED"] as const;
export function AttributionTab() {
  const t = useTranslations("admin.analytics");
  const format = useFormat();
  const { range } = useAdminDashboard();
  const [model, setModel] = useState<(typeof MODELS)[number]>("LAST_CLICK");
  const { data, isLoading } = useAdminGet<{ conversions: number; channels: Array<{ channel: string; value: number; share: number }> }>("attribution", "/analytic/attribution", { ...rangeToDates(range), model });
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t("attribution")} description={t("attributionHint")} actions={<SelectField label={t("model")} value={model} onChange={(e) => setModel(e.target.value as typeof model)} options={MODELS.map((m) => ({ value: m, label: t(`models.${m}`) }))} />} />
      <p className="text-sm text-slate-600">{t("conversionsCount", { n: data?.conversions ?? 0 })}</p>
      <ul className="flex flex-col gap-2">
        {(data?.channels ?? []).map((row) => (
          <li key={row.channel} className="flex flex-col gap-1">
            <span className="flex justify-between text-sm"><span>{row.channel}</span><span className="tabular-nums">{format.money(row.value)} · {pct(row.share)}</span></span>
            <span aria-hidden="true" className="h-2 rounded bg-muted"><span className="block h-2 rounded bg-indigo-600" style={{ width: `${Math.max(1, row.share * 100)}%` }} /></span>
          </li>
        ))}
      </ul>
      {isLoading && <p className="text-sm text-slate-500">…</p>}
    </section>
  );
}

// ---------- RF-24.12 cripto ----------
export function CryptoTab() {
  const t = useTranslations("admin.analytics");
  const format = useFormat();
  const { range } = useAdminDashboard();
  const { data, isLoading } = useAdminGet<{ byAsset: Array<{ asset: string; network: string; payments: number; succeeded: number; amountCents: number; cryptoAmount: number; avgConfirmSeconds: number | null; successRate: number }>; share: { payments: number; revenue: number; cryptoCents: number }; blockchain: Array<{ chain: string; status: string; count: number }> }>("crypto-analytics", "/analytic/crypto", rangeToDates(range));
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={t("crypto")} description={t("cryptoHint")} />
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KPICard label={t("cryptoRevenue")} value={format.money(data.share.cryptoCents)} />
          <KPICard label={t("cryptoShareRevenue")} value={pct(data.share.revenue)} />
          <KPICard label={t("cryptoSharePayments")} value={pct(data.share.payments)} />
        </div>
      )}
      <DataTable
        caption={t("crypto")}
        rows={data?.byAsset}
        loading={isLoading}
        rowKey={(row) => `${row.asset}-${row.network}`}
        columns={[
          { key: "asset", header: t("asset"), cell: (row) => `${row.asset} · ${row.network}` },
          { key: "payments", header: t("payments"), cell: (row) => `${row.succeeded}/${row.payments}`, className: "text-right tabular-nums" },
          { key: "amount", header: t("amount"), cell: (row) => `${format.money(row.amountCents)} (${row.cryptoAmount} ${row.asset})`, className: "text-right" },
          { key: "confirm", header: t("avgConfirm"), cell: (row) => (row.avgConfirmSeconds === null ? "—" : `${Math.round(row.avgConfirmSeconds / 60)} min`), className: "text-right" },
        ]}
      />
      <DataTable caption={t("blockchain")} rows={data?.blockchain} rowKey={(row) => `${row.chain}-${row.status}`} columns={[{ key: "chain", header: t("chain"), cell: (row) => row.chain }, { key: "status", header: t("status"), cell: (row) => row.status }, { key: "count", header: t("count"), cell: (row) => row.count, className: "text-right tabular-nums" }]} />
    </section>
  );
}

// ---------- RF-24.10 alertas ----------
const ALERT_METRICS = ["REVENUE_LAST_HOUR", "ORDERS_LAST_HOUR", "CONVERSION_TODAY", "PAYMENT_FAILURES_LAST_HOUR", "CART_ABANDONMENT_TODAY", "LCP_P75_TODAY"] as const;
const alertSchema = z.object({
  name: z.string().trim().min(3, "validation.min3").max(120),
  metric: z.enum(ALERT_METRICS),
  operator: z.enum(["LT", "GT"]),
  threshold: z.coerce.number(),
  cooldownMinutes: z.coerce.number().int().min(5).max(1440),
  active: z.boolean(),
});
interface AlertRule extends z.infer<typeof alertSchema> {
  id: string;
  lastValue: number | null;
  lastTriggeredAt: string | null;
}
export function AlertsTab() {
  const t = useTranslations("admin.analytics");
  const format = useFormat();
  const fields = [
    { name: "name", label: t("alertName") },
    { name: "metric", label: t("metric"), type: "select" as const, options: toOptions(ALERT_METRICS, (m) => t(`alertMetrics.${m}`)) },
    { name: "operator", label: t("operator"), type: "select" as const, options: [{ value: "LT", label: t("operators.LT") }, { value: "GT", label: t("operators.GT") }] },
    { name: "threshold", label: t("threshold"), type: "number" as const, hint: t("thresholdHint") },
    { name: "cooldownMinutes", label: t("cooldown"), type: "number" as const },
    { name: "active", label: t("active"), type: "checkbox" as const },
  ];
  return (
    <AdminResource<AlertRule, typeof alertSchema, typeof alertSchema>
      resource="alert-rules"
      path="/analytic/alert"
      title={t("alerts")}
      rowLabel={(row) => row.name}
      columns={[
        { key: "name", header: t("alertName"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "rule", header: t("metric"), cell: (row) => `${t(`alertMetrics.${row.metric}`)} ${row.operator === "LT" ? "<" : ">"} ${row.threshold}` },
        { key: "last", header: t("lastValue"), cell: (row) => (row.lastValue === null ? "—" : Math.round(row.lastValue * 100) / 100), className: "text-right tabular-nums" },
        { key: "fired", header: t("lastTriggered"), cell: (row) => (row.lastTriggeredAt ? format.dateTime(row.lastTriggeredAt) : "—") },
        { key: "active", header: t("active"), cell: (row) => (row.active ? "✓" : "—") },
      ]}
      create={{ schema: alertSchema, fields, initialValues: { name: "", metric: "ORDERS_LAST_HOUR", operator: "LT", threshold: 1, cooldownMinutes: 60, active: true } }}
      edit={{ schema: alertSchema, fields, toValues: (row) => ({ name: row.name, metric: row.metric, operator: row.operator, threshold: row.threshold, cooldownMinutes: row.cooldownMinutes, active: row.active }) }}
      remove
    />
  );
}

// ---------- RF-24.14 simulación de promociones ----------
interface Simulation {
  price_cents: number;
  elasticity: number;
  days: Array<{ date: string; baseline: number; simulated: number; promo: boolean }>;
  baseline_units: number;
  simulated_units: number;
  incremental_units: number;
  baseline_revenue_cents: number;
  simulated_revenue_cents: number;
  event_lift: number;
  price_effect: number;
  lift_source: string;
}
export function SimulationTab() {
  const t = useTranslations("admin.analytics");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const [productId, setProductId] = useState("");
  const [discount, setDiscount] = useState(20);
  const [event, setEvent] = useState<"NONE" | "BLACK_FRIDAY" | "CYBER_MONDAY" | "CHRISTMAS">("BLACK_FRIDAY");
  const [promoDays, setPromoDays] = useState(3);
  const products = useAdminGet<Array<{ id: string; name: string }>>("sim-products", "/product", { limit: 100, status: "ACTIVE" });
  const sim = useAdminMutation<void, Simulation>([], () => ({ path: "/forecasting/simulate", method: "POST", baseUrl: LLM_ADMIN.baseUrl, body: { product_id: productId, discount: discount / 100, event, promo_days: promoDays, horizon_days: 30 } }));
  const result = sim.data;
  const max = Math.max(1, ...(result?.days.map((d) => Math.max(d.baseline, d.simulated)) ?? [1]));
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={t("simulation")} description={t("simulationHint")} />
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); if (productId) sim.mutate(undefined, { onError: (err) => toast.error(errorMessage(err)) }); }}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">{t("product")}
          <select value={productId} onChange={(e) => setProductId(e.target.value)} required className="h-9 rounded-md border px-2">
            <option value="">—</option>
            {(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">{t("discount")}<input type="number" min={0} max={90} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="h-9 rounded-md border px-2" /></label>
        <label className="flex flex-col gap-1 text-sm">{t("event")}
          <select value={event} onChange={(e) => setEvent(e.target.value as typeof event)} className="h-9 rounded-md border px-2">
            {(["NONE", "BLACK_FRIDAY", "CYBER_MONDAY", "CHRISTMAS"] as const).map((v) => <option key={v} value={v}>{t(`events2.${v}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">{t("promoDays")}<input type="number" min={1} max={31} value={promoDays} onChange={(e) => setPromoDays(Number(e.target.value))} className="h-9 rounded-md border px-2" /></label>
        <Button type="submit" loading={sim.isPending} className="self-start">{t("simulate")}</Button>
      </form>
      {result && (
        <div aria-live="polite" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KPICard label={t("incrementalUnits")} value={String(result.incremental_units)} />
            <KPICard label={t("simRevenue")} value={format.money(result.simulated_revenue_cents)} change={result.baseline_revenue_cents ? result.simulated_revenue_cents / result.baseline_revenue_cents - 1 : undefined} trendLabel={t("vsBaseline")} />
            <KPICard label={t("eventLift")} value={`×${result.event_lift} (${t(`liftSources.${result.lift_source}`)})`} />
            <KPICard label={t("priceEffect")} value={`×${result.price_effect} · e=${result.elasticity}`} />
          </div>
          {/* Barras diarias: base (gris) vs. simulada (color); texto en title para cada día */}
          <ul aria-label={t("dailyDemand")} className="flex h-40 items-end gap-0.5 rounded-lg border p-2">
            {result.days.map((day) => (
              <li key={day.date} title={`${day.date}: ${day.baseline} → ${day.simulated}`} className="relative flex h-full flex-1 items-end">
                <span aria-hidden="true" className="absolute bottom-0 w-full bg-slate-200" style={{ height: `${(day.baseline / max) * 100}%` }} />
                <span aria-hidden="true" className={`relative w-full ${day.promo ? "bg-rose-500" : "bg-indigo-400"} opacity-80`} style={{ height: `${(day.simulated / max) * 100}%` }} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
