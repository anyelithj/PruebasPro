// AnalyticsPanel.tsx (Client Component) => analítica del panel: serie por período (día/semana/mes), totales,
// embudo de conversión paso a paso, abandono de carrito y reportes por dimensión (producto, categoría, marca, ruta,
// canal, evento). Lee GET /analytic/metric y /analytic/report (CQRS: read models cacheados 5 min en Redis).
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAdminGet, type MetricsResponse, type ReportRow } from "../api/dashboard.api";
import { RANGES, rangeToDates, useAdminDashboard, type Range } from "../model/dashboard.store";
import { KPICard } from "./KPICard";
import { DataTable } from "./DataTable";
import { SectionHeader, SelectField } from "./AdminFields";
import { AdminResource, DialogButton, FormAction } from "./AdminResource";
import { GraphView } from "./GrowthAdmin"; // RF-18.9 visualización del grafo
import { z } from "zod";
import { useFormat } from "@/shared/hook/useFormat";
import { AdminTabs } from "./AdminTabs";
import { AlertsTab, AttributionTab, CryptoTab, ExportButton, HeatmapTab, SimulationTab } from "./AnalyticsAdvanced"; // RF-24.x
import { CohortsTab } from "./CrmInsights"; // RF-24.2 cohortes
import { Skeleton } from "@/shared/ui/Skeleton";

const SalesChart = dynamic(() => import("./SalesChart"), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });

const GRANULARITIES = ["day", "week", "month", "quarter", "year"] as const; // RF-24.9 trimestre y año
const DIMENSIONS = ["product", "category", "brand", "path", "channel", "event"] as const;
const MONEY_DIMENSIONS = new Set(["product", "category", "brand"]); // Ranking por ingresos (los demás por conteo)

// AnalyticsPanel => pestañas de analítica: resumen, mapa de calor/rendimiento, atribución, cohortes, cripto, alertas
// y simulación de promociones
export function AnalyticsPanel() {
  const t = useTranslations("admin.analytics");
  return (
    <AdminTabs
      section="analytics"
      label={t("tabs.label")}
      tabs={[
        { id: "overview", label: t("tabs.overview"), render: () => <OverviewTab /> },
        { id: "heatmap", label: t("tabs.heatmap"), description: t("help.heatmap"), render: () => <HeatmapTab /> },
        { id: "attribution", label: t("tabs.attribution"), description: t("help.attribution"), render: () => <AttributionTab /> },
        { id: "cohorts", label: t("tabs.cohorts"), description: t("help.cohorts"), render: () => <CohortsTab /> },
        { id: "crypto", label: t("tabs.crypto"), description: t("help.crypto"), render: () => <CryptoTab /> },
        { id: "alerts", label: t("tabs.alerts"), description: t("help.alerts"), render: () => <AlertsTab /> },
        { id: "simulation", label: t("tabs.simulation"), description: t("help.simulation"), render: () => <SimulationTab /> },
      ]}
    />
  );
}

function OverviewTab() {
  const t = useTranslations("admin.analytics");
  const format = useFormat();
  const [compare, setCompare] = useState(false); // RF-24.9 comparar con el período anterior
  const { range, setRange } = useAdminDashboard();
  const [granularity, setGranularity] = useState<(typeof GRANULARITIES)[number]>("day");
  const [dimension, setDimension] = useState<(typeof DIMENSIONS)[number]>("product");
  const dates = rangeToDates(range);
  const metrics = useAdminGet<MetricsResponse & { previous?: { totals: MetricsResponse["totals"] } }>("analytics", "/analytic/metric", { ...dates, granularity, compare: compare ? "true" : undefined });
  const report = useAdminGet<{ rows: ReportRow[] }>("analytics", "/analytic/report", { ...dates, dimension, limit: 10 });
  const totals = metrics.data?.totals;
  const previous = metrics.data?.previous?.totals;
  const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
  // change => variación relativa contra el período anterior (solo con "comparar" activo)
  const change = (key: "revenueCents" | "sessions" | "conversionRate") => (previous && totals && previous[key] ? totals[key] / previous[key] - 1 : undefined);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={t("title")}
        actions={
          <>
            <SelectField label={t("range")} value={range} onChange={(event) => setRange(event.target.value as Range)} options={RANGES.map((value) => ({ value, label: t(`ranges.${value}`) }))} />
            <SelectField label={t("granularity")} value={granularity} onChange={(event) => setGranularity(event.target.value as typeof granularity)} options={GRANULARITIES.map((value) => ({ value, label: t(`granularities.${value}`) }))} />
            <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />{t("compare")}</label>
            <ExportButton report="metric" granularity={granularity} />
          </>
        }
      />
      <section aria-label={t("totals")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label={t("revenue")} value={totals ? format.money(totals.revenueCents) : "—"} change={change("revenueCents")} trendLabel={t("vsPrevious")} />
        <KPICard label={t("sessions")} value={totals ? totals.sessions.toLocaleString() : "—"} change={change("sessions")} trendLabel={t("vsPrevious")} />
        <KPICard label={t("conversion")} value={totals ? percent(totals.conversionRate) : "—"} change={change("conversionRate")} trendLabel={t("vsPrevious")} />
        <KPICard label={t("cartAbandonment")} value={metrics.data ? percent(metrics.data.cartAbandonmentRate) : "—"} />
      </section>

      <SalesChart data={metrics.data?.series ?? []} title={t("salesChart")} />

      {/* Embudo de conversión: barras proporcionales accesibles (texto con conteo y tasa en cada paso) */}
      <section aria-labelledby="funnel-title" className="flex flex-col gap-2">
        <h3 id="funnel-title" className="text-sm font-semibold text-slate-700">
          {t("funnel")}
        </h3>
        <ol className="flex flex-col gap-2">
          {(metrics.data?.funnel ?? []).map((step) => (
            <li key={step.step} className="flex flex-col gap-1">
              <span className="flex justify-between text-sm">
                <span>{t(`events.${step.step}`)}</span>
                <span className="tabular-nums text-slate-600">
                  {step.count.toLocaleString()} · {percent(step.rate)}
                </span>
              </span>
              <span className="h-2 rounded bg-muted" aria-hidden="true">
                <span className="block h-2 rounded bg-slate-800" style={{ width: `${Math.max(step.rate * 100, 1)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title={t("report")}
          actions={
            <>
              <SelectField label={t("dimension")} value={dimension} onChange={(event) => setDimension(event.target.value as typeof dimension)} options={DIMENSIONS.map((value) => ({ value, label: t(`dimensions.${value}`) }))} />
              <ExportButton report={dimension} granularity={granularity} />
            </>
          }
        />
        <DataTable
          caption={t("report")}
          loading={report.isLoading}
          rows={report.data?.rows}
          rowKey={(row) => row.key}
          columns={[
            { key: "label", header: t(`dimensions.${dimension}`), cell: (row) => (dimension === "event" ? t(`events.${row.label}`) : row.label) },
            { key: "value", header: MONEY_DIMENSIONS.has(dimension) ? t("revenue") : t("count"), cell: (row) => (MONEY_DIMENSIONS.has(dimension) ? format.money(row.value) : row.value.toLocaleString()), className: "text-right" },
            ...(dimension === "product"
              ? [
                  { key: "views", header: t("views"), cell: (row: ReportRow) => row.views ?? 0, className: "text-right" },
                  { key: "cart", header: t("addToCart"), cell: (row: ReportRow) => row.addToCart ?? 0, className: "text-right" },
                  { key: "units", header: t("units"), cell: (row: ReportRow) => row.units ?? 0, className: "text-right" },
                ]
              : []),
          ]}
        />
      </section>

      <GraphPanel />
    </div>
  );
}

// ---------- Análisis relacional de productos (AI Graph Analysis, Express /product-graph) ----------

// GraphQuery => resultado guardado de un análisis (GraphQueryDto de Express)
interface GraphQuery {
  id: string;
  queryType: "RELATED" | "PURCHASED_TOGETHER" | "SIMILAR" | "CLUSTER";
  nodes: Array<{ id: string; name: string; group: number }>;
  edges: Array<{ source: string; target: string; weight: number }>;
  summary: string | null;
  durationMs: number;
  createdAt: string;
}

// clusterSchema => CLUSTER agrupa productos comprados juntos; "explain" pide el resumen al LLM (opcional: cuesta energía)
const clusterSchema = z.object({
  minWeight: z.coerce.number().int().min(1).max(100),
  explain: z.boolean(),
});

function GraphPanel() {
  const t = useTranslations("admin.analytics");
  const format = useFormat();
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t("graph")} description={t("graphHint")} />
      <AdminResource<GraphQuery>
        resource="product-graph"
        path="/product-graph"
        title={t("graph")}
        toolbar={
          <FormAction
            variant="primary"
            label={t("runCluster")}
            title={t("runCluster")}
            resources={["product-graph"]}
            schema={clusterSchema}
            initialValues={{ minWeight: 2, explain: false }}
            fields={[
              { name: "minWeight", label: t("minWeight"), type: "number", hint: t("minWeightHint") },
              { name: "explain", label: t("explain"), type: "checkbox" },
            ]}
            toRequest={(values) => ({ path: "/product-graph/query", method: "POST", body: { queryType: "CLUSTER", params: values } })}
          />
        }
        columns={[
          { key: "date", header: t("date"), cell: (row) => format.dateTime(row.createdAt) },
          { key: "type", header: t("queryType"), cell: (row) => t(`queryTypes.${row.queryType}`) },
          { key: "size", header: t("size"), cell: (row) => t("graphSize", { nodes: row.nodes.length, edges: row.edges.length }) },
          // Grupos (comunidades) con sus productos: lectura textual del grafo (accesible, sin librería de grafos)
          { key: "groups", header: t("groups"), cell: (row) => <GraphGroups nodes={row.nodes} /> },
          { key: "summary", header: t("summary"), cell: (row) => <span className="line-clamp-3 text-xs">{row.summary ?? "—"}</span> },
        ]}
        actions={(row) => (
          <DialogButton icon="chart" label={`${t("viewGraph")} ${format.dateTime(row.createdAt)}`} title={t("viewGraph")}>
            {() => <GraphView graph={row} />}
          </DialogButton>
        )}
        remove
      />
    </section>
  );
}

// GraphGroups => nodos agrupados por comunidad ("Map" conserva el orden de inserción); máx. 3 grupos visibles
function GraphGroups({ nodes }: { nodes: GraphQuery["nodes"] }) {
  const groups = new Map<number, string[]>();
  nodes.forEach((node) => groups.set(node.group, [...(groups.get(node.group) ?? []), node.name]));
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {[...groups.values()].slice(0, 3).map((names, index) => (
        <li key={index}>{names.slice(0, 4).join(" · ")}{names.length > 4 ? " …" : ""}</li>
      ))}
    </ul>
  );
}
