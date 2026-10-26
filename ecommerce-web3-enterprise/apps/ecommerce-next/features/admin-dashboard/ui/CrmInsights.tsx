// CrmInsights.tsx (Client Component · React + TanStack Query + Tailwind) => CRM avanzado del panel:
//  - SegmentsTab: RF-22.2 segmentos personalizados por reglas (con vista previa de cuántos clientes entran)
//  - CohortsTab: RF-22.7 / RF-24.2 retención por cohortes (tabla de calor con texto: no depende solo del color)
//  - HighValueTab: RF-22.6 clientes de alto valor (CLV a 12 meses) y su riesgo de abandono
//  - DuplicatesTab: RF-22.4 duplicados sugeridos + fusión, e importación de clientes por CSV
//  - CustomerInsights / CustomerJourney: RF-22.8 siguiente mejor acción, RF-22.10 upsell y anomalías, RF-22.9 recorrido
// Patrones: Composite + Command + Facade (un endpoint por vista). Accesibilidad: tablas con caption, aria-live.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useAdminGet, useAdminMutation } from "../api/dashboard.api";
import { AdminResource, useAdminCommand } from "./AdminResource";
import { DataTable } from "./DataTable";
import { KPICard } from "./KPICard";
import { SectionHeader } from "./AdminFields";
import { StatusBadge } from "./OrdersAdmin";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";
import { toast } from "@/shared/ui/Toast";

const RISK_TONE = { LOW: "APPROVED", MEDIUM: "PENDING", HIGH: "FAILED" } as const;
const optionalInt = z.union([z.literal(""), z.coerce.number().int().min(0)]).transform((v) => (v === "" ? undefined : v));
// segmentSchema => formulario de reglas (vacío = no aplica); pesos -> centavos en toBody
const segmentSchema = z.object({
  name: z.string().trim().min(3, "validation.min3").max(80),
  description: z.string().trim().max(300).optional(),
  minOrders: optionalInt,
  maxOrders: optionalInt,
  minLtv: optionalInt,
  lastOrderWithinDays: optionalInt,
  noOrderForDays: optionalInt,
  registeredWithinDays: optionalInt,
  city: z.string().trim().max(80).optional(),
  tags: z.string().trim().max(200).optional(),
});
type SegmentValues = z.output<typeof segmentSchema>;
interface CustomSegment {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown>;
}

// toRules => valores del formulario -> reglas de Express (solo las definidas)
const toRules = (v: SegmentValues) =>
  Object.fromEntries(
    Object.entries({
      minOrders: v.minOrders,
      maxOrders: v.maxOrders,
      minLtvCents: v.minLtv !== undefined ? v.minLtv * 100 : undefined,
      lastOrderWithinDays: v.lastOrderWithinDays || undefined,
      noOrderForDays: v.noOrderForDays || undefined,
      registeredWithinDays: v.registeredWithinDays || undefined,
      city: v.city || undefined,
      tags: v.tags ? v.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined,
    }).filter(([, value]) => value !== undefined)
  );

export function SegmentsTab() {
  const t = useTranslations("admin.crm");
  const errorMessage = useErrorMessage();
  const preview = useAdminMutation<Record<string, unknown>, { count: number }>([], (rules) => ({ path: "/crm/segment/preview", method: "POST", body: { rules } }));
  const fields = [
    { name: "name", label: t("segmentName") },
    { name: "description", label: t("description"), type: "textarea" as const },
    { name: "minOrders", label: t("rules.minOrders"), type: "number" as const },
    { name: "maxOrders", label: t("rules.maxOrders"), type: "number" as const },
    { name: "minLtv", label: t("rules.minLtv"), type: "number" as const },
    { name: "lastOrderWithinDays", label: t("rules.lastOrderWithinDays"), type: "number" as const },
    { name: "noOrderForDays", label: t("rules.noOrderForDays"), type: "number" as const },
    { name: "registeredWithinDays", label: t("rules.registeredWithinDays"), type: "number" as const },
    { name: "city", label: t("rules.city") },
    { name: "tags", label: t("rules.tags"), hint: t("rules.tagsHint") },
  ];
  const empty = { name: "", description: "", minOrders: "", maxOrders: "", minLtv: "", lastOrderWithinDays: "", noOrderForDays: "", registeredWithinDays: "", city: "", tags: "" } as const;
  return (
    <AdminResource<CustomSegment, typeof segmentSchema, typeof segmentSchema>
      resource="crm-segments"
      path="/crm/segment"
      title={t("segments")}
      rowLabel={(row) => row.name}
      columns={[
        { key: "name", header: t("segmentName"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "rules", header: t("rulesTitle"), cell: (row) => <code className="text-xs">{Object.entries(row.rules).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : String(v)}`).join(" · ")}</code> },
      ]}
      actions={(row) => (
        <Button size="sm" variant="ghost" onClick={() => preview.mutate(row.rules, { onSuccess: (data) => toast.success(t("previewResult", { count: data.count })), onError: (error) => toast.error(errorMessage(error)) })}>
          {t("preview")}
        </Button>
      )}
      create={{ schema: segmentSchema, fields, initialValues: empty, toBody: (v) => ({ name: v.name, description: v.description || undefined, rules: toRules(v) }) }}
      edit={{
        schema: segmentSchema,
        fields,
        toValues: (row) => ({ ...empty, name: row.name, description: row.description ?? "", ...Object.fromEntries(Object.entries(row.rules).map(([k, v]) => [k === "minLtvCents" ? "minLtv" : k, k === "minLtvCents" ? Number(v) / 100 : Array.isArray(v) ? v.join(", ") : v])) }),
        toBody: (v) => ({ name: v.name, description: v.description || undefined, rules: toRules(v) }),
      }}
      remove
    />
  );
}

export function CohortsTab() {
  const t = useTranslations("admin.crm");
  const [months, setMonths] = useState(12);
  const { data = [], isLoading } = useAdminGet<Array<{ cohort: string; size: number; retention: number[] }>>("crm-cohorts", "/crm/cohort", { months });
  const width = Math.max(1, ...data.map((row) => row.retention.length));
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={t("cohorts")}
        description={t("cohortsHint")}
        actions={
          <label className="flex items-center gap-2 text-sm">{t("months")}
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-9 rounded-md border border-slate-300 px-3 text-sm">
              {[6, 12, 24].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        }
      />
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <caption className="sr-only">{t("cohorts")}</caption>
            <thead><tr><th scope="col" className="p-2 text-left">{t("cohort")}</th><th scope="col" className="p-2 text-right">{t("customers")}</th>{Array.from({ length: width }, (_, i) => <th key={i} scope="col" className="p-2 text-center">M{i}</th>)}</tr></thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.cohort} className="border-t">
                  <th scope="row" className="p-2 text-left font-medium">{row.cohort}</th>
                  <td className="p-2 text-right tabular-nums">{row.size}</td>
                  {Array.from({ length: width }, (_, i) => {
                    const value = row.retention[i];
                    return <td key={i} className="p-2 text-center tabular-nums" style={value !== undefined ? { backgroundColor: `rgba(37, 99, 235, ${Math.min(0.85, value)})`, color: value > 0.45 ? "#fff" : undefined } : undefined}>{value !== undefined ? `${Math.round(value * 100)}%` : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function HighValueTab() {
  const t = useTranslations("admin.crm");
  const format = useFormat();
  const { data = [], isLoading } = useAdminGet<Array<{ id: string; name: string; email: string; orders: number; ltvCents: number; clv12m: number; churnRisk: "LOW" | "MEDIUM" | "HIGH"; segment: string }>>("crm-high-value", "/crm/high-value");
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t("highValue")} description={t("highValueHint")} />
      <DataTable
        caption={t("highValue")}
        rows={data}
        loading={isLoading}
        rowKey={(row) => row.id}
        columns={[
          { key: "name", header: t("customer"), cell: (row) => <span className="flex flex-col"><span className="font-medium">{row.name}</span><span className="text-xs text-slate-500">{row.email}</span></span> },
          { key: "orders", header: t("orders"), cell: (row) => row.orders, className: "text-right tabular-nums" },
          { key: "ltv", header: "LTV", cell: (row) => format.money(row.ltvCents), className: "text-right" },
          { key: "clv", header: t("clv12m"), cell: (row) => format.money(row.clv12m), className: "text-right" },
          { key: "risk", header: t("churnRisk"), cell: (row) => <StatusBadge status={RISK_TONE[row.churnRisk]} label={t(`risks.${row.churnRisk}`)} /> },
        ]}
      />
    </section>
  );
}

export function DuplicatesTab() {
  const t = useTranslations("admin.crm");
  const { data = [], isLoading } = useAdminGet<Array<{ reason: "PHONE" | "NAME"; ids: string[]; emails: string[]; name: string }>>("crm-duplicates", "/crm/duplicate");
  const { run } = useAdminCommand(["crm-duplicates", "customers"]);
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={t("duplicates")} description={t("duplicatesHint")} actions={<ImportCustomers />} />
      {isLoading ? <Skeleton className="h-32 w-full" /> : data.length === 0 ? <p className="text-sm text-slate-600">{t("noDuplicates")}</p> : (
        <ul className="flex flex-col gap-3">
          {data.map((group) => (
            <li key={group.ids.join()} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{group.name} · {t(`reasons.${group.reason}`)}</p>
              <ul className="flex flex-col gap-1">
                {group.ids.slice(1).map((id, index) => (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{group.emails[index + 1]} → {group.emails[0]}</span>
                    <Button size="sm" variant="secondary" onClick={() => window.confirm(t("confirmMerge", { from: group.emails[index + 1] ?? "", to: group.emails[0] ?? "" })) && void run({ path: "/crm/merge", method: "POST", body: { primaryId: group.ids[0], duplicateId: id } }, t("merged"))}>
                      {t("merge")}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ImportCustomers => lee el CSV en el navegador (FileReader nativo) y lo envía como texto
function ImportCustomers() {
  const t = useTranslations("admin.crm");
  const errorMessage = useErrorMessage();
  const mutation = useAdminMutation<string, { created: number; updated: number; errors: Array<{ line: number; message: string }> }>(["customers", "crm-duplicates"], (csv) => ({ path: "/crm/import", method: "POST", body: { csv } }));
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50">
      {mutation.isPending ? t("importing") : t("importCsv")}
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          mutation.mutate(await file.text(), {
            onSuccess: (r) => toast.success(t("imported", { created: r.created, updated: r.updated, errors: r.errors.length })),
            onError: (error) => toast.error(errorMessage(error)),
          });
          event.target.value = "";
        }}
      />
    </label>
  );
}

// ---------- Ficha 360: insights + recorrido ----------
interface Insights {
  churnRisk: "LOW" | "MEDIUM" | "HIGH";
  clv12m: number;
  nextBestAction: string;
  anomalies: string[];
  upsell: Array<{ id: string; name: string; slug: string; priceCents: number }>;
}
export function CustomerInsights({ id }: { id: string }) {
  const t = useTranslations("admin.crm");
  const format = useFormat();
  const { data } = useAdminGet<Insights>(`crm-insights-${id}`, `/crm/customer/${id}/insights`);
  if (!data) return null;
  return (
    <section aria-labelledby="crm-insights" className="flex flex-col gap-3">
      <h3 id="crm-insights" className="text-sm font-semibold">{t("insights")}</h3>
      <div className="grid grid-cols-2 gap-3">
        <KPICard label={t("nextBestAction")} value={t(`actions.${data.nextBestAction}`)} />
        <KPICard label={t("clv12m")} value={format.money(data.clv12m)} />
      </div>
      <p className="text-sm"><StatusBadge status={RISK_TONE[data.churnRisk]} label={`${t("churnRisk")}: ${t(`risks.${data.churnRisk}`)}`} /></p>
      {data.anomalies.length > 0 && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800">⚠ {data.anomalies.map((a) => t(`anomalies.${a}`)).join(" · ")}</p>}
      {data.upsell.length > 0 && <p className="text-sm"><span className="font-medium">{t("upsell")}: </span>{data.upsell.map((p) => `${p.name} (${format.money(p.priceCents)})`).join(", ")}</p>}
    </section>
  );
}

interface Journey {
  sessions: Array<{ sessionId: string; startedAt: string; channel: string | null; steps: string[]; purchased: boolean }>;
  orders: Array<{ id: string; orderNumber: string; totalCents: number; channel: string; placedAt: string }>;
  channels: string[];
}
export function CustomerJourney({ id }: { id: string }) {
  const t = useTranslations("admin.crm");
  const format = useFormat();
  const { data } = useAdminGet<Journey>(`crm-journey-${id}`, `/analytic/journey/${id}`);
  if (!data || (data.sessions.length === 0 && data.orders.length === 0)) return null;
  // Línea de tiempo: sesiones (con su canal y pasos) y pedidos ordenados por fecha
  const timeline = [
    ...data.sessions.map((s) => ({ at: s.startedAt, label: `${s.channel ?? t("direct")} · ${s.steps.join(" → ")}`, purchase: s.purchased })),
    ...data.orders.map((o) => ({ at: o.placedAt, label: `${t("order")} ${o.orderNumber} · ${format.money(o.totalCents)}`, purchase: true })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <section aria-labelledby="crm-journey" className="flex flex-col gap-2">
      <h3 id="crm-journey" className="text-sm font-semibold">{t("journey")} · {data.channels.join(", ") || t("direct")}</h3>
      <ol className="flex flex-col gap-2 border-l pl-4 text-xs">
        {timeline.slice(-20).map((item, index) => (
          <li key={index} className="relative">
            <span aria-hidden="true" className={`absolute -left-[21px] top-1 size-2.5 rounded-full ${item.purchase ? "bg-emerald-600" : "bg-slate-400"}`} />
            <time dateTime={item.at} className="text-slate-500">{format.dateTime(item.at)}</time> — {item.label}
          </li>
        ))}
      </ol>
    </section>
  );
}
