// AiAssistantAdmin.tsx (Client Component) => administración del LLM Assistant (FastAPI + Ollama local, 0 USD):
// base de conocimiento RAG (re-indexar, ver y borrar fragmentos), auditoría de herramientas que usó el modelo y
// evaluaciones de calidad (fidelidad, alucinación, latencia, tokens) registradas en MLflow.
// Patrones: Composite (pestañas) + Command (re-indexar / evaluar: trabajos Celery asíncronos, 202 Accepted).
// Ahorro: re-indexar y evaluar son explícitos (botón) => el modelo de embeddings solo trabaja cuando se pide.
"use client";

import { useTranslations } from "next-intl";
import { useAdminList } from "../api/dashboard.api";
import { AdminResource, FormAction, toOptions, IconAction, PAGE_SIZE } from "./AdminResource";
import { AdminTabs } from "./AdminTabs";
import { KPICard } from "./KPICard";
import { McpTab } from "./SettingsAdmin"; // Acciones que ejecutó el asistente (con "Deshacer"): viven junto al asistente
import { StatusBadge } from "./OrdersAdmin";
import { ContactTab, NluTab, SupportTab } from "./SupportAdmin"; // RF-17.11 / 17.12 / 17.13 · RF-21.2
import { CHUNK_SOURCES, KNOWLEDGE_SOURCES, LLM_ADMIN, TOOL_STATUSES, type KnowledgeChunk, type LlmEvaluationRun, type LlmToolCall } from "@/features/ai-chat/api/llm-admin.api";
import { useFormat } from "@/shared/hook/useFormat";
import { z } from "zod";

// Schemas locales de los dos comandos (formularios de una o dos opciones: no ameritan el validador global)
const indexSchema = z.object({ sources: z.array(z.enum(KNOWLEDGE_SOURCES)).min(1, "validation.required") });
const evaluationSchema = z.object({ tier: z.enum(["economic", "strong"]) });
const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)} %`);

export function AiAssistantAdmin() {
  const t = useTranslations("admin.ai");
  return (
    <AdminTabs
      section="ai-assistant"
      label={t("tabs.label")}
      tabs={[
        { id: "support", label: t("tabs.support"), description: t("help.support"), render: () => <SupportTab /> },
        { id: "nlu", label: t("tabs.nlu"), description: t("help.nlu"), render: () => <NluTab /> },
        { id: "contact", label: t("tabs.contact"), description: t("help.contact"), render: () => <ContactTab /> },
        { id: "knowledge", label: t("tabs.knowledge"), description: t("help.knowledge"), render: () => <KnowledgeTab /> },
        { id: "tools", label: t("tabs.tools"), description: t("help.tools"), render: () => <ToolCallsTab /> },
        { id: "actions", label: t("tabs.actions"), description: t("help.actions"), render: () => <McpTab /> },
        { id: "evaluations", label: t("tabs.evaluations"), description: t("help.evaluations"), render: () => <EvaluationsTab /> },
      ]}
    />
  );
}

// ---------- Conocimiento RAG ----------
function KnowledgeTab() {
  const t = useTranslations("admin.ai");
  return (
    <AdminResource<KnowledgeChunk>
      resource="llm-knowledge"
      path={LLM_ADMIN.knowledge}
      baseUrl={LLM_ADMIN.baseUrl}
      title={t("tabs.knowledge")}
      rowLabel={(row) => row.title}
      filters={[
        { name: "source", label: t("source"), options: toOptions(CHUNK_SOURCES, (value) => t(`sources.${value}`)) },
        { name: "lang", label: t("lang"), options: toOptions(["es", "en"], (value) => value.toUpperCase()) },
      ]}
      toolbar={
        <>
          <FormAction
            variant="primary"
            label={t("reindex")}
            title={t("reindex")}
            resources={["llm-knowledge"]}
            submitLabel={t("start")}
            success={t("jobAccepted")}
            schema={indexSchema}
            initialValues={{ sources: [...KNOWLEDGE_SOURCES] }}
            fields={[{ name: "sources", label: t("source"), type: "checkboxes", options: toOptions(KNOWLEDGE_SOURCES, (value) => t(`indexSources.${value}`)) }]}
            toRequest={(values) => ({ path: LLM_ADMIN.knowledgeIndex, method: "POST", body: values, baseUrl: LLM_ADMIN.baseUrl })}
          />
          <ClearKnowledge />
        </>
      }
      columns={[
        { key: "title", header: t("titleCol"), cell: (row) => <span className="font-medium">{row.title}</span> },
        { key: "source", header: t("source"), cell: (row) => t(`sources.${row.source}`) },
        { key: "lang", header: t("lang"), cell: (row) => row.lang.toUpperCase() },
        // line-clamp => muestra 2 líneas del fragmento; el texto completo queda en "title" (tooltip nativo)
        { key: "content", header: t("content"), cell: (row) => <span title={row.content} className="line-clamp-2 text-xs text-slate-600">{row.content}</span> },
      ]}
      remove
    />
  );
}

// ClearKnowledge => DELETE /knowledge (borra todo el índice; se reconstruye con "Re-indexar")
function ClearKnowledge() {
  const t = useTranslations("admin.ai");
  return (
    <FormAction
      variant="secondary"
      label={t("clear")}
      title={t("clearTitle")}
      resources={["llm-knowledge"]}
      submitLabel={t("clearConfirm")}
      success={t("cleared")}
      schema={z.object({})}
      initialValues={{}}
      fields={[]}
      toRequest={() => ({ path: LLM_ADMIN.knowledge, method: "DELETE", baseUrl: LLM_ADMIN.baseUrl })}
    />
  );
}

// ---------- Auditoría de herramientas ----------
function ToolCallsTab() {
  const t = useTranslations("admin.ai");
  const format = useFormat();
  return (
    <AdminResource<LlmToolCall>
      resource="llm-tools"
      path={LLM_ADMIN.toolCalls}
      baseUrl={LLM_ADMIN.baseUrl}
      title={t("tabs.tools")}
      search="tool"
      filters={[{ name: "status", label: t("status"), options: toOptions(TOOL_STATUSES, (value) => t(`toolStatus.${value}`)) }]}
      columns={[
        { key: "date", header: t("date"), cell: (row) => format.dateTime(row.created_at) },
        { key: "tool", header: t("tool"), cell: (row) => <code>{row.tool}</code> },
        { key: "args", header: t("arguments"), cell: (row) => <code className="break-all text-xs">{JSON.stringify(row.arguments)}</code> },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status === "ok" ? "DELIVERED" : "FAILED"} label={t(`toolStatus.${row.status}`)} /> },
        { key: "latency", header: t("latency"), cell: (row) => `${row.latency_ms} ms`, className: "text-right tabular-nums" },
      ]}
    />
  );
}

// ---------- Evaluaciones ----------
function EvaluationsTab() {
  const t = useTranslations("admin.ai");
  const tc = useTranslations("admin.common");
  const format = useFormat();
  // Última corrida terminada => tarjetas de métricas (misma clave de caché que la tabla de abajo, página 1)
  const runs = useAdminList<LlmEvaluationRun>("llm-evals", LLM_ADMIN.evaluations, { page: 1, limit: PAGE_SIZE }, LLM_ADMIN.baseUrl);
  const last = runs.data?.data.find((run) => run.status === "COMPLETED");
  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("lastRun")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label={t("faithfulness")} value={percent(last?.faithfulness ?? null)} />
        <KPICard label={t("hallucination")} value={percent(last?.hallucination_rate ?? null)} />
        <KPICard label={t("latency")} value={last?.avg_latency_ms ? `${last.avg_latency_ms} ms` : "—"} />
        <KPICard label={t("tokens")} value={last?.est_tokens?.toLocaleString() ?? "—"} />
      </section>
      <AdminResource<LlmEvaluationRun>
        resource="llm-evals"
        path={LLM_ADMIN.evaluations}
        baseUrl={LLM_ADMIN.baseUrl}
        title={t("tabs.evaluations")}
        toolbar={
          <FormAction
            variant="primary"
            label={tc("new")}
            title={t("evaluate")}
            resources={["llm-evals"]}
            submitLabel={t("start")}
            success={t("jobAccepted")}
            schema={evaluationSchema}
            initialValues={{ tier: "economic" }}
            fields={[{ name: "tier", label: t("tier"), type: "select", options: toOptions(["economic", "strong"], (value) => t(`tiers.${value}`)) }]}
            toRequest={(values) => ({ path: LLM_ADMIN.evaluations, method: "POST", body: values, baseUrl: LLM_ADMIN.baseUrl })}
          />
        }
        columns={[
          { key: "date", header: t("date"), cell: (row) => format.dateTime(row.created_at) },
          { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status === "COMPLETED" ? "DELIVERED" : row.status} label={row.status} /> },
          { key: "model", header: t("model"), cell: (row) => row.model ?? t(`tiers.${row.tier}`) },
          { key: "faith", header: t("faithfulness"), cell: (row) => percent(row.faithfulness), className: "text-right tabular-nums" },
          { key: "hall", header: t("hallucination"), cell: (row) => percent(row.hallucination_rate), className: "text-right tabular-nums" },
          { key: "lat", header: t("latency"), cell: (row) => (row.avg_latency_ms ? `${row.avg_latency_ms} ms` : "—"), className: "text-right tabular-nums" },
        ]}
        actions={(row) => <IconAction icon="alert" disabled={!row.error} label={row.error ? `${t("error")}: ${row.error}` : t("error")} onClick={() => window.alert(row.error)} />}
        remove
      />
    </div>
  );
}
