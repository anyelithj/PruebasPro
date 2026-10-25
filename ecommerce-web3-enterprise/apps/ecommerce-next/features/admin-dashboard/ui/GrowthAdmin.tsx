// GrowthAdmin.tsx (Client Component · React + SVG + Tailwind) => crecimiento con IA:
//  - ChurnPanel: RF-18.8 clientes en riesgo de abandono (días sin comprar vs. su ritmo) + reactivar ahora
//  - GraphView: RF-18.9 visualización del grafo de conocimiento (nodos por grupo, aristas por peso) en SVG puro
//  - MarkdownPlanner: RF-18.10 calendario de rebajas con balance configurable ingresos/utilidad (FastAPI)
// Patrones: Composite + Command + Strategy (el layout del grafo es una función pura). Sin librerías de gráficos:
// SVG nativo (0 KB extra). Accesibilidad: SVG con role="img" y descripción; los datos también en tabla/lista.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAdminGet, useAdminMutation } from "../api/dashboard.api";
import { useAdminCommand } from "./AdminResource";
import { DataTable } from "./DataTable";
import { SectionHeader } from "./AdminFields";
import { StatusBadge } from "./OrdersAdmin";
import { LLM_ADMIN } from "@/features/ai-chat/api/llm-admin.api";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { Button } from "@/shared/ui/Button";
import { toast } from "@/shared/ui/Toast";

// ---------- RF-18.8 riesgo de abandono ----------
interface ChurnRow {
  userId: string;
  name: string;
  email: string;
  orders: number;
  daysSinceLastOrder: number;
  avgIntervalDays: number;
  ratio: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
}
const RISK_TONE = { LOW: "ACTIVE", MEDIUM: "PENDING", HIGH: "FAILED" } as const; // Reutiliza los tonos de StatusBadge

export function ChurnPanel() {
  const t = useTranslations("admin.growth");
  const [risk, setRisk] = useState<"MEDIUM" | "HIGH">("MEDIUM");
  const { data = [], isLoading } = useAdminGet<ChurnRow[]>("churn", "/crm/churn", { risk, limit: 100 });
  const { run, isPending } = useAdminCommand(["churn"]);
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={t("churnTitle")}
        description={t("churnHint")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              {t("minRisk")}
              <select value={risk} onChange={(event) => setRisk(event.target.value as "MEDIUM" | "HIGH")} className="h-9 rounded-md border px-2">
                <option value="MEDIUM">{t("risks.MEDIUM")}</option>
                <option value="HIGH">{t("risks.HIGH")}</option>
              </select>
            </label>
            <Button size="sm" loading={isPending} onClick={() => void run({ path: "/crm/reactivate", method: "POST" }, t("reactivated"))}>{t("reactivate")}</Button>
          </div>
        }
      />
      <DataTable
        caption={t("churnTitle")}
        rows={data}
        loading={isLoading}
        rowKey={(row) => row.userId}
        columns={[
          { key: "name", header: t("customer"), cell: (row) => <span className="flex flex-col"><span className="font-medium">{row.name}</span><span className="text-xs text-slate-500">{row.email}</span></span> },
          { key: "orders", header: t("orders"), cell: (row) => row.orders, className: "text-right tabular-nums" },
          { key: "days", header: t("daysSince"), cell: (row) => row.daysSinceLastOrder, className: "text-right tabular-nums" },
          { key: "interval", header: t("interval"), cell: (row) => row.avgIntervalDays, className: "text-right tabular-nums" },
          { key: "risk", header: t("risk"), cell: (row) => <StatusBadge status={RISK_TONE[row.risk]} label={`${t(`risks.${row.risk}`)} · ×${row.ratio}`} /> },
        ]}
      />
    </section>
  );
}

// ---------- RF-18.9 grafo de conocimiento ----------
interface GraphData {
  nodes: Array<{ id: string; name: string; group: number }>;
  edges: Array<{ source: string; target: string; weight: number }>;
}
const COLORS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#4b5563"];

// layout => posición determinista: cada grupo en un punto de un círculo grande y sus nodos en un círculo pequeño
// alrededor (función PURA: mismo grafo => mismo dibujo; sin simulación de fuerzas que gaste CPU)
export function layout(nodes: GraphData["nodes"], size: number): Map<string, { x: number; y: number }> {
  const groups = [...new Set(nodes.map((node) => node.group))];
  const center = size / 2;
  const big = groups.length > 1 ? size * 0.32 : 0;
  const positions = new Map<string, { x: number; y: number }>();
  groups.forEach((group, gi) => {
    const members = nodes.filter((node) => node.group === group);
    const gx = center + big * Math.cos((2 * Math.PI * gi) / groups.length);
    const gy = center + big * Math.sin((2 * Math.PI * gi) / groups.length);
    const small = Math.min(size * 0.14, 14 + members.length * 6);
    members.forEach((node, ni) => {
      const angle = (2 * Math.PI * ni) / Math.max(1, members.length);
      positions.set(node.id, { x: gx + (members.length > 1 ? small * Math.cos(angle) : 0), y: gy + (members.length > 1 ? small * Math.sin(angle) : 0) });
    });
  });
  return positions;
}

export function GraphView({ graph }: { graph: GraphData }) {
  const t = useTranslations("admin.growth");
  const size = 520;
  const positions = layout(graph.nodes, size);
  const maxWeight = Math.max(1, ...graph.edges.map((edge) => edge.weight));
  const [hover, setHover] = useState<string | null>(null);
  const names = new Map(graph.nodes.map((node) => [node.id, node.name]));
  return (
    <figure className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("graphAria", { nodes: graph.nodes.length, edges: graph.edges.length })} className="h-auto w-full max-w-xl self-center rounded-lg border bg-white">
        {graph.edges.map((edge) => {
          const a = positions.get(edge.source);
          const b = positions.get(edge.target);
          if (!a || !b) return null;
          const active = hover === edge.source || hover === edge.target;
          return <line key={`${edge.source}-${edge.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? "#0f172a" : "#94a3b8"} strokeOpacity={active ? 0.9 : 0.35} strokeWidth={0.5 + (edge.weight / maxWeight) * 3} />;
        })}
        {graph.nodes.map((node) => {
          const p = positions.get(node.id)!;
          return (
            <g key={node.id} onMouseEnter={() => setHover(node.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(node.id)} onBlur={() => setHover(null)} tabIndex={0}>
              <title>{node.name}</title>
              <circle cx={p.x} cy={p.y} r={hover === node.id ? 9 : 6} fill={COLORS[node.group % COLORS.length]} stroke="#fff" strokeWidth={1.5} />
              {hover === node.id && <text x={p.x + 10} y={p.y - 8} fontSize={12} fill="#0f172a">{node.name}</text>}
            </g>
          );
        })}
      </svg>
      {/* Lectura textual: patrones de compra más fuertes (accesible y útil para el equipo) */}
      <figcaption className="text-sm">
        <p className="font-medium">{t("strongest")}</p>
        <ol className="ml-5 list-decimal text-slate-700">
          {[...graph.edges].sort((a, b) => b.weight - a.weight).slice(0, 5).map((edge) => (
            <li key={`${edge.source}-${edge.target}`}>{names.get(edge.source)} ↔ {names.get(edge.target)} ({edge.weight})</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

// ---------- RF-18.10 optimización de rebajas ----------
interface MarkdownPlan {
  price_cents: number;
  stock: number;
  unit_cost_cents: number;
  elasticity: number;
  weekly_units: number;
  schedule: number[];
  weekly_prices_cents: number[];
  units: number[];
  revenue_cents: number;
  profit_cents: number;
  leftover_units: number;
  sell_through: number;
  alternatives: Array<{ schedule: number[]; revenue_cents: number; profit_cents: number; leftover_units: number }>;
}

export function MarkdownPlanner({ productId }: { productId: string }) {
  const t = useTranslations("admin.growth");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const [weeks, setWeeks] = useState(4);
  const [weight, setWeight] = useState(0.5);
  const [cost, setCost] = useState("");
  const plan = useAdminMutation<void, MarkdownPlan>([], () => ({
    path: `/pricing/${productId}/markdown`,
    method: "POST",
    baseUrl: LLM_ADMIN.baseUrl,
    body: { weeks, revenue_weight: weight, ...(cost ? { unit_cost_cents: Math.round(Number(cost) * 100) } : {}) },
  }));
  const result = plan.data;
  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          plan.mutate(undefined, { onError: (error) => toast.error(errorMessage(error)) });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">{t("weeks")}
          <input type="number" min={1} max={8} value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} className="h-9 rounded-md border px-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">{t("unitCost")}
          <input type="number" min={0} step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} placeholder={t("unitCostHint")} className="h-9 rounded-md border px-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          {t("balance", { revenue: Math.round(weight * 100), profit: Math.round((1 - weight) * 100) })}
          <input type="range" min={0} max={1} step={0.1} value={weight} onChange={(event) => setWeight(Number(event.target.value))} aria-valuetext={t("balance", { revenue: Math.round(weight * 100), profit: Math.round((1 - weight) * 100) })} />
        </label>
        <Button type="submit" loading={plan.isPending} className="self-start">{t("optimize")}</Button>
      </form>
      {result && (
        <div aria-live="polite" className="flex flex-col gap-3 text-sm">
          <p>{t("planSummary", { stock: result.stock, sold: Math.round(result.sell_through * 100), revenue: format.money(result.revenue_cents), profit: format.money(result.profit_cents) })}</p>
          <table className="w-full">
            <caption className="sr-only">{t("schedule")}</caption>
            <thead className="border-b text-left text-slate-600"><tr><th scope="col" className="py-1">{t("week")}</th><th scope="col">{t("discount")}</th><th scope="col">{t("price")}</th><th scope="col" className="text-right">{t("units")}</th></tr></thead>
            <tbody>
              {result.schedule.map((discount, index) => (
                <tr key={index} className="border-b last:border-0">
                  <td className="py-1">{index + 1}</td>
                  <td>{Math.round(discount * 100)} %</td>
                  <td>{format.money(result.weekly_prices_cents[index] ?? 0)}</td>
                  <td className="text-right tabular-nums">{result.units[index]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500">{t("elasticityNote", { elasticity: result.elasticity, leftover: result.leftover_units })}</p>
        </div>
      )}
    </div>
  );
}
