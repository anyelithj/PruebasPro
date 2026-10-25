// AuditCenter.tsx (Client Component · React 19 + TanStack Query + Socket.io + Tailwind) => centro de auditoría:
//  - AuditTab: RF-30.1/30.2/30.6/30.9 registro con filtros (texto completo, usuario, IP, módulo, servicio, fecha,
//    severidad, revisado), RF-30.3 descarga CSV/PDF con los MISMOS filtros y RF-30.8 monitoreo en tiempo real
//  - AuditInsightsTab: RF-30.7 dashboard de eventos + reporte de cumplimiento (PDF) y RF-30.4 detección de anomalías
// Patrones: Observer (useAdminSocket: cada lote nuevo refresca la tabla y el feed), Command (revisar, detectar,
// descargar), Composite (tarjetas + barras + controles). Paradigma declarativo (React) + funcional (helpers puros).
// Accesibilidad: formulario de filtros con <label> reales, feed en vivo con aria-live="polite", barras con texto.
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { downloadAuthed, useAdminGet, useAdminMutation, useAdminSocket, type AuditLog, type AuditReport, type ComplianceReport, type Query } from "../api/dashboard.api";
import { AdminResource, IconAction } from "./AdminResource";
import { KPICard } from "./KPICard";
import { SectionHeader } from "./AdminFields";
import { useAuth } from "@/shared/hook/useAuth";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { toast } from "@/shared/ui/Toast";

const SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
const SOURCES = ["HTTP", "EVENT", "EXTERNAL"] as const;
const SEVERITY_TONE = { INFO: "neutral", WARNING: "warning", CRITICAL: "danger" } as const;
const FIELD = "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const DAY_MS = 86_400_000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10); // "YYYY-MM-DD" para <input type="date">

// toQuery => FormData del formulario -> filtros sin campos vacíos; "to" incluye el día completo (función pura)
function toQuery(data: FormData): Query {
  const entries = [...data.entries()].map(([key, value]) => [key, String(value).trim()] as const).filter(([, value]) => value !== "");
  const query: Query = Object.fromEntries(entries);
  if (typeof query["to"] === "string") query["to"] = `${query["to"]}T23:59:59`;
  return query;
}

// toSearch => filtros -> "a=1&b=2" para la URL de descarga (los mismos que ve la tabla: lo que ves es lo que exportas)
const toSearch = (query: Query) => new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString();

// ---------- RF-30.1 / 30.2 / 30.3 / 30.6 / 30.8 / 30.9 registro ----------
export function AuditTab() {
  const t = useTranslations("admin.settings");
  const format = useFormat();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<Query>({});
  const [live, setLive] = useState(false);
  const [feed, setFeed] = useState<Array<Partial<AuditLog> & { at: string }>>([]);

  // RF-30.8 cada lote del backend (cada ~2 s como máximo) entra al feed y refresca la tabla
  useAdminSocket<Array<Partial<AuditLog>>>(live, "audit", "audit:entries", (entries) => {
    const at = new Date().toISOString();
    setFeed((previous) => [...entries.map((entry) => ({ ...entry, at })), ...previous].slice(0, 20));
    void queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Sin recarga: los filtros viajan como query del listado
    setQuery(toQuery(new FormData(event.currentTarget)));
  };
  const download = (kind: "csv" | "pdf") =>
    accessToken && downloadAuthed(`/audit/log/export?${toSearch({ ...query, format: kind })}`, `auditoria.${kind}`, accessToken).catch(() => toast.error(t("auditCenter.downloadError")));

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} onReset={() => setQuery({})} aria-label={t("auditCenter.filters")} className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          {t("auditCenter.q")}
          <input name="q" type="search" minLength={2} maxLength={120} placeholder={t("auditCenter.qHint")} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("auditCenter.actor")}
          <input name="actorId" maxLength={100} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          IP
          <input name="ip" maxLength={45} inputMode="decimal" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("module")}
          <input name="module" maxLength={60} placeholder="product, order…" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("auditCenter.source")}
          <select name="source" defaultValue="" className={FIELD}>
            <option value="">{t("auditCenter.all")}</option>
            {SOURCES.map((value) => <option key={value} value={value}>{t(`auditCenter.sources.${value}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("severity")}
          <select name="severity" defaultValue="" className={FIELD}>
            <option value="">{t("auditCenter.all")}</option>
            {SEVERITIES.map((value) => <option key={value} value={value}>{t(`severities.${value}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("reviewed")}
          <select name="reviewed" defaultValue="" className={FIELD}>
            <option value="">{t("auditCenter.all")}</option>
            <option value="false">{t("pending")}</option>
            <option value="true">{t("yes")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("auditCenter.from")}
          <input name="from" type="date" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("auditCenter.to")}
          <input name="to" type="date" className={FIELD} />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
          <Button type="submit" size="sm">{t("auditCenter.apply")}</Button>
          <Button type="reset" size="sm" variant="ghost">{t("auditCenter.reset")}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void download("csv")}>{t("auditCenter.csv")}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void download("pdf")}>{t("auditCenter.pdf")}</Button>
          {/* aria-pressed => botón conmutador: el lector de pantalla anuncia si el monitoreo está activo */}
          <Button type="button" size="sm" variant={live ? "primary" : "secondary"} aria-pressed={live} onClick={() => setLive((value) => !value)}>
            {live ? t("auditCenter.liveOn") : t("auditCenter.liveOff")}
          </Button>
        </div>
      </form>

      {live && (
        <section aria-labelledby="audit-live" className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <h3 id="audit-live" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-emerald-600" />
            {t("auditCenter.liveTitle")}
          </h3>
          <ol aria-live="polite" className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs">
            {feed.length === 0 && <li className="text-slate-500">{t("auditCenter.liveEmpty")}</li>}
            {feed.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex flex-wrap gap-2">
                <time dateTime={entry.at} className="tabular-nums text-slate-500">{format.dateTime(entry.at)}</time>
                <Badge tone={SEVERITY_TONE[entry.severity ?? "INFO"]}>{t(`severities.${entry.severity ?? "INFO"}`)}</Badge>
                <span className="break-all">{entry.action}</span>
                <span className="text-slate-500">{entry.ip ?? ""}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* "key" => al cambiar los filtros la tabla se reinicia en la página 1 */}
      <AdminResource<AuditLog>
        key={toSearch(query)}
        resource="audit"
        path="/audit/log"
        title={t("tabs.audit")}
        query={query}
        rowLabel={(row) => row.action}
        columns={[
          { key: "date", header: t("date"), cell: (row) => format.dateTime(row.createdAt) },
          { key: "severity", header: t("severity"), cell: (row) => <Badge tone={SEVERITY_TONE[row.severity]}>{t(`severities.${row.severity}`)}</Badge> },
          { key: "module", header: t("module"), cell: (row) => row.module },
          { key: "action", header: t("action"), cell: (row) => <span className="break-all text-xs">{row.action}</span> },
          { key: "source", header: t("auditCenter.source"), cell: (row) => t(`auditCenter.sources.${row.source}`) },
          { key: "status", header: "HTTP", cell: (row) => row.status ?? "—", className: "text-right tabular-nums" },
          { key: "ip", header: "IP", cell: (row) => row.ip ?? "—" },
          // RF-30.9 quién revisó y cuándo
          { key: "reviewed", header: t("reviewed"), cell: (row) => (row.reviewed ? t("auditCenter.reviewedBy", { by: row.reviewedBy ?? "—", at: row.reviewedAt ? format.dateTime(row.reviewedAt) : "—" }) : t("pending")) },
        ]}
        actions={(row, run) =>
          <IconAction icon="check" disabled={row.reviewed} label={t("markReviewed")} onClick={() => void run({ path: `/audit/log/${row.id}`, method: "PATCH", body: { reviewed: true } })} />
        }
      />
    </div>
  );
}

// BarList => barras horizontales accesibles: el número va en texto, la barra es decorativa (aria-hidden)
function BarList({ title, rows }: { title: string; rows: Array<{ key: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-1.5 text-xs">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-2">
            <span className="truncate" title={row.key}>{row.key}</span>
            <span aria-hidden="true" className="h-2 rounded bg-slate-800" style={{ width: `${Math.max((row.count / max) * 100, 2)}%` }} />
            <span className="tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- RF-30.4 / 30.7 dashboard, cumplimiento y anomalías ----------
export function AuditInsightsTab() {
  const t = useTranslations("admin.settings.auditCenter");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const { accessToken } = useAuth();
  const [range, setRange] = useState({ from: isoDay(Date.now() - 30 * DAY_MS), to: isoDay(Date.now()) });
  const query = { from: range.from, to: `${range.to}T23:59:59` };
  const report = useAdminGet<AuditReport>("audit", "/audit/report", query);
  const compliance = useAdminGet<ComplianceReport>("audit", "/audit/compliance", query);
  const scan = useAdminMutation<void, { fired: number }>(["audit"], () => ({ path: "/audit/anomaly/scan", method: "POST" }));
  const critical = report.data?.bySeverity.find((row) => row.key === "CRITICAL")?.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={t("insightsTitle")}
        description={t("insightsHelp")}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm">
              {t("from")}
              <input type="date" value={range.from} max={range.to} onChange={(event) => setRange((value) => ({ ...value, from: event.target.value }))} className={FIELD} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              {t("to")}
              <input type="date" value={range.to} min={range.from} onChange={(event) => setRange((value) => ({ ...value, to: event.target.value }))} className={FIELD} />
            </label>
            <Button size="sm" variant="secondary" loading={scan.isPending} onClick={() => scan.mutate(undefined, { onSuccess: (result) => toast.success(t("scanDone", { count: result.fired })), onError: (error) => toast.error(errorMessage(error)) })}>
              {t("scan")}
            </Button>
          </>
        }
      />

      {/* RF-30.7 dashboard de visualización de eventos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label={t("total")} value={format.number(report.data?.total ?? 0)} />
        <KPICard label={t("critical")} value={format.number(critical)} />
        <KPICard label={t("unreviewed")} value={format.number(report.data?.unreviewedCritical ?? 0)} />
        <KPICard label={t("score")} value={`${compliance.data?.score ?? 0} %`} />
      </div>
      {report.data && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <BarList title={t("byDay")} rows={report.data.byDay} />
          <BarList title={t("byModule")} rows={report.data.byModule} />
          <BarList title={t("topActors")} rows={report.data.topActors} />
        </div>
      )}

      {/* RF-30.7 reporte de cumplimiento: cada control con su evidencia; el estado va en texto, no solo en color */}
      <section aria-labelledby="compliance-title" className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="compliance-title" className="text-base font-semibold">{t("complianceTitle")}</h3>
          <Button size="sm" variant="secondary" onClick={() => accessToken && downloadAuthed(`/audit/compliance?${toSearch({ ...query, format: "pdf" })}`, "cumplimiento.pdf", accessToken).catch(() => toast.error(t("downloadError")))}>
            {t("compliancePdf")}
          </Button>
        </div>
        <ul className="flex flex-col divide-y text-sm">
          {(compliance.data?.controls ?? []).map((control) => (
            <li key={control.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">{control.title}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {control.evidence}
                <Badge tone={control.passed ? "success" : "danger"}>{control.passed ? t("passed") : t("failed")}</Badge>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">{t("anomalyHelp")}</p>
      </section>
    </div>
  );
}
