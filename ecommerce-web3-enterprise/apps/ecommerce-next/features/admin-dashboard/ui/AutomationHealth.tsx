// AutomationHealth.tsx (Client Component · React + TanStack Query + Tailwind) => automatización sin código:
//  - HealthTab: RF-20.7 salud en tiempo casi real (refresco cada 15 s): tasa de éxito, duración media y p95, último
//    error por flujo y serie diaria de ejecuciones; historial de versiones con restauración (rollback)
//  - TemplatesTab: RF-20.2 / RF-20.8 plantillas listas (WhatsApp, inventario, factura, segmentación, campañas,
//    reactivación, seguimiento multicanal) que se instalan en n8n con un clic o se descargan como JSON
// Patrones: Composite + Command + Observer (polling de TanStack Query). Gráfico de barras en CSS (sin librerías).
"use client";

import { useTranslations } from "next-intl";
import { useAdminGet } from "../api/dashboard.api";
import { DialogButton, IconAction, useAdminCommand } from "./AdminResource";
import { DataTable } from "./DataTable";
import { KPICard } from "./KPICard";
import { SectionHeader } from "./AdminFields";
import { StatusBadge } from "./OrdersAdmin";
import { useFormat } from "@/shared/hook/useFormat";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";

interface WorkflowHealth {
  workflowId: string;
  name: string;
  active: boolean;
  version: number;
  runs: number;
  success: number;
  failed: number;
  running: number;
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  lastRunAt: string | null;
  lastError: string | null;
  health: "HEALTHY" | "DEGRADED" | "FAILING" | "IDLE";
}
interface AutomationHealth {
  totals: { runs: number; success: number; failed: number; successRate: number; avgDurationMs: number };
  timeline: Array<{ day: string; success: number; failed: number }>;
  workflows: WorkflowHealth[];
}
interface WorkflowVersion {
  version: number;
  snapshot: Record<string, unknown>;
  changedBy: string;
  createdAt: string;
}
interface Template {
  key: string;
  name: string;
  description: string;
  triggerType: string;
  event: string | null;
  nodes: number;
}

const HEALTH_TONE = { HEALTHY: "APPROVED", DEGRADED: "PENDING", FAILING: "FAILED", IDLE: "DRAFT" } as const;
const pct = (value: number) => `${(value * 100).toFixed(1)} %`;

export function HealthTab() {
  const t = useTranslations("admin.automation");
  const format = useFormat();
  const { data, isLoading } = useAdminGet<AutomationHealth>("automation-health", "/automation/health", { days: 7 }, { refetchInterval: 15_000 });
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const max = Math.max(1, ...data.timeline.map((day) => day.success + day.failed));
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title={t("healthTitle")} description={t("healthHint")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label={t("runs")} value={format.number(data.totals.runs)} />
        <KPICard label={t("successRate")} value={pct(data.totals.successRate)} />
        <KPICard label={t("failed")} value={format.number(data.totals.failed)} />
        <KPICard label={t("avgDuration")} value={`${format.number(data.totals.avgDurationMs)} ms`} />
      </div>
      {/* Serie diaria: barras apiladas en CSS (éxito/fallo) + texto para lectores de pantalla */}
      <ul aria-label={t("timeline")} className="flex h-32 items-end gap-1 rounded-lg border p-3">
        {data.timeline.map((day) => (
          <li key={day.day} className="flex h-full flex-1 flex-col justify-end" title={`${day.day}: ${day.success} / ${day.failed}`}>
            <span className="sr-only">{t("dayLabel", { day: day.day, success: day.success, failed: day.failed })}</span>
            <span aria-hidden="true" className="block rounded-t bg-red-500" style={{ height: `${(day.failed / max) * 100}%` }} />
            <span aria-hidden="true" className="block bg-emerald-500" style={{ height: `${(day.success / max) * 100}%` }} />
          </li>
        ))}
      </ul>
      <DataTable
        caption={t("healthTitle")}
        rows={data.workflows}
        rowKey={(row) => row.workflowId}
        columns={[
          { key: "name", header: t("name"), cell: (row) => <span className="font-medium">{row.name}</span> },
          { key: "health", header: t("health"), cell: (row) => <StatusBadge status={HEALTH_TONE[row.health]} label={t(`healthStates.${row.health}`)} /> },
          { key: "rate", header: t("successRate"), cell: (row) => `${pct(row.successRate)} (${row.success}/${row.success + row.failed})`, className: "text-right tabular-nums" },
          { key: "duration", header: t("duration"), cell: (row) => `${row.avgDurationMs} / ${row.p95DurationMs} ms`, className: "text-right tabular-nums" },
          { key: "last", header: t("lastRun"), cell: (row) => (row.lastRunAt ? format.dateTime(row.lastRunAt) : "—") },
          { key: "error", header: t("lastError"), cell: (row) => <span className="line-clamp-2 text-xs text-red-700">{row.lastError ?? "—"}</span> },
          {
            key: "versions",
            header: t("version"),
            cell: (row) => (
              <DialogButton icon="list" label={`${t("versions")} ${row.name}`} title={`${t("versions")} · ${row.name}`}>
                {() => <VersionsView workflowId={row.workflowId} current={row.version} />}
              </DialogButton>
            ),
          },
        ]}
      />
    </div>
  );
}

function VersionsView({ workflowId, current }: { workflowId: string; current: number }) {
  const t = useTranslations("admin.automation");
  const format = useFormat();
  const { data = [], isLoading } = useAdminGet<WorkflowVersion[]>(`automation-versions-${workflowId}`, `/automation/${workflowId}/versions`);
  const { run } = useAdminCommand(["automation-health", "workflows", `automation-versions-${workflowId}`]);
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (data.length === 0) return <p className="text-sm text-slate-600">{t("noVersions", { version: current })}</p>;
  return (
    <ol className="flex flex-col gap-3 text-sm">
      {data.map((version) => (
        <li key={version.version} className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="font-medium">v{version.version} · {format.dateTime(version.createdAt)}</p>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify(version.snapshot, null, 2)}</pre>
          </div>
          <IconAction icon="undo" label={`${t("restore")} v${version.version}`} onClick={() => void run({ path: `/automation/${workflowId}/rollback`, method: "POST", body: { version: version.version } }, t("restored"))} />
        </li>
      ))}
    </ol>
  );
}

export function TemplatesTab() {
  const t = useTranslations("admin.automation");
  const { data = [], isLoading } = useAdminGet<Template[]>("automation-templates", "/automation/template");
  const { run, isPending } = useAdminCommand(["workflows", "automation-health"]);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title={t("templatesTitle")} description={t("templatesHint")} />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.map((template) => (
          <li key={template.key} className="flex flex-col gap-2 rounded-lg border p-4">
            <h3 className="font-semibold">{template.name}</h3>
            <p className="text-sm text-slate-600">{template.description}</p>
            <p className="text-xs text-slate-500">{template.event ?? template.triggerType} · {t("nodes", { n: template.nodes })}</p>
            <Button size="sm" className="self-start" loading={isPending} onClick={() => void run({ path: `/automation/template/${template.key}`, method: "POST" }, t("installed"))}>{t("install")}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
