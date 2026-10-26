// SupportAdmin.tsx (Client Component · React + TanStack Query + Tailwind) => soporte humano y calidad del chatbot:
//  - SupportTab: RF-17.12 tiempos de respuesta/resolución y escalados; RF-17.11 bandeja de conversaciones escaladas
//    (Chatwoot o panel propio) con asignación manual/automática, respuesta con plantillas rápidas y cierre
//  - NluTab: RF-17.13 cola de mensajes reales para etiquetar (intención/entidades) y RF-17.12 precisión medida
// Patrones: Composite (pestañas de AiAssistantAdmin) + Command (useAdminCommand) + Adapter (AdminResource sobre
// Express y FastAPI con el mismo contrato). Accesibilidad: <dl> para métricas, <label> en cada campo, aria-live.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useAdminGet } from "../api/dashboard.api";
import { AdminResource, DialogButton, FormAction, IconAction, toOptions, useAdminCommand } from "./AdminResource";
import { KPICard } from "./KPICard";
import { SectionHeader } from "./AdminFields";
import { StatusBadge } from "./OrdersAdmin";
import { LLM_ADMIN } from "@/features/ai-chat/api/llm-admin.api";
import { useFormat } from "@/shared/hook/useFormat";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";

// ---------- Tipos (contratos de Express /communication y FastAPI /nlp) ----------
interface Conversation {
  id: string;
  userId: string;
  channel: "WEB" | "WHATSAPP" | "EMAIL";
  status: "OPEN" | "ESCALATED" | "ARCHIVED";
  agentId: string | null;
  escalationReason: string | null;
  chatwootId: string | null;
  lastMessage: { role: string; content: string } | null;
  lastMessageAt: string;
}
interface SupportMetrics {
  conversations: number;
  escalated: number;
  escalationRate: number;
  lowConfidenceEscalations: number;
  avgFirstResponseSeconds: number | null;
  avgAgentResponseSeconds: number | null;
  avgResolutionMinutes: number | null;
  resolved: number;
  intents: Record<string, number>;
  nlu: NluMetrics | null;
}
interface NluMetrics {
  examples: number;
  intents: { samples: number; accuracy: number | null; per_intent: Record<string, { precision: number | null; recall: number; support: number }> };
  entities: { samples: number; precision: number | null; recall: number | null; f1: number | null };
}
interface Canned {
  id: string | number;
  shortCode: string;
  content: string;
}
interface TrainingExample {
  id: string;
  text: string;
  intent: string;
  predicted_intent: string | null;
  confidence: number | null;
  entities: Array<{ label: string; text: string }>;
  source: string;
  approved: boolean;
  created_at: string;
}

const INTENTS = ["greeting", "order_status", "product_search", "recommendation", "returns", "human"] as const;
const pct = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)} %`);
const replySchema = z.object({ content: z.string().trim().min(1, "validation.required").max(2000) });
const cannedSchema = z.object({ shortCode: z.string().trim().regex(/^[a-z0-9_-]{2,30}$/, "validation.required"), content: z.string().trim().min(3, "validation.required").max(2000) });
const labelSchema = z.object({ intent: z.enum(INTENTS), entities: z.string().trim().max(500), approved: z.boolean() });

// ---------- Soporte: métricas + bandeja ----------
export function SupportTab() {
  const t = useTranslations("admin.support");
  const format = useFormat();
  const [days, setDays] = useState(30);
  // refetchInterval => el tablero se actualiza solo cada minuto mientras está abierto
  const metrics = useAdminGet<SupportMetrics>("support-metrics", "/communication/support/metrics", { days }, { refetchInterval: 60_000 });
  const seconds = (value: number | null) => (value === null ? "—" : value < 120 ? `${value} s` : `${Math.round(value / 60)} min`);
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={t("metricsTitle")}
        description={t("metricsHint")}
        actions={
          <label className="flex items-center gap-2 text-sm">
            {t("period")}
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="h-9 rounded-md border border-slate-300 px-3 text-sm">
              {[7, 30, 90].map((value) => <option key={value} value={value}>{t("days", { n: value })}</option>)}
            </select>
          </label>
        }
      />
      {metrics.isLoading || !metrics.data ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard label={t("firstResponse")} value={seconds(metrics.data.avgFirstResponseSeconds)} />
          <KPICard label={t("agentResponse")} value={seconds(metrics.data.avgAgentResponseSeconds)} />
          <KPICard label={t("resolution")} value={metrics.data.avgResolutionMinutes === null ? "—" : `${metrics.data.avgResolutionMinutes} min`} />
          <KPICard label={t("escalation")} value={`${pct(metrics.data.escalationRate)} · ${format.number(metrics.data.escalated)}`} />
          <KPICard label={t("lowConfidence")} value={format.number(metrics.data.lowConfidenceEscalations)} />
          <KPICard label={t("intentAccuracy")} value={pct(metrics.data.nlu?.intents.accuracy)} />
          <KPICard label={t("entityF1")} value={pct(metrics.data.nlu?.entities.f1)} />
          <KPICard label={t("conversations")} value={format.number(metrics.data.conversations)} />
        </div>
      )}

      <AdminResource<Conversation>
        resource="support-conversations"
        path="/communication"
        title={t("inbox")}
        query={{ status: "ESCALATED" }}
        detail={false}
        rowLabel={(row) => row.id}
        filters={[{ name: "channel", label: t("channel"), options: toOptions(["WEB", "WHATSAPP", "EMAIL"], (value) => t(`channels.${value}`)) }]}
        toolbar={<CannedButton />}
        columns={[
          { key: "date", header: t("date"), cell: (row) => format.dateTime(row.lastMessageAt) },
          { key: "channel", header: t("channel"), cell: (row) => t(`channels.${row.channel}`) },
          { key: "reason", header: t("reason"), cell: (row) => row.escalationReason ?? "—" },
          { key: "last", header: t("lastMessage"), cell: (row) => <span className="line-clamp-2 text-xs text-slate-600">{row.lastMessage?.content ?? "—"}</span> },
          { key: "agent", header: t("agent"), cell: (row) => (row.agentId ? <StatusBadge status="ASSIGNED" label={t("assigned")} /> : <StatusBadge status="PENDING" label={t("unassigned")} />) },
          { key: "hub", header: "Chatwoot", cell: (row) => (row.chatwootId ? `#${row.chatwootId}` : "—") },
        ]}
        actions={(row, run) => (
          <>
            <IconAction icon="users" label={`${t("autoAssign")} ${row.id}`} onClick={() => void run({ path: `/communication/${row.id}/assign`, method: "POST", body: {} }, t("assignedOk"))} />
            <DialogButton icon="mail" label={`${t("reply")} ${row.id}`} title={t("reply")}>
              {(close) => <ReplyForm conversationId={row.id} onDone={close} />}
            </DialogButton>
            <IconAction icon="undo" label={`${t("close")} ${row.id}`} onClick={() => void run({ path: `/communication/${row.id}`, method: "DELETE" }, t("closed"))} />
          </>
        )}
      />
    </div>
  );
}

// ReplyForm => respuesta del agente con plantillas rápidas (RF-17.11); se replica en Chatwoot si la conversación está allá
function ReplyForm({ conversationId, onDone }: { conversationId: string; onDone: () => void }) {
  const t = useTranslations("admin.support");
  const canned = useAdminGet<Canned[]>("support-canned", "/communication/support/canned");
  const { run, isPending } = useAdminCommand(["support-conversations", "support-metrics"]);
  const [content, setContent] = useState("");
  const parsed = replySchema.safeParse({ content });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (parsed.success && (await run({ path: `/communication/${conversationId}/message`, method: "POST", body: parsed.data }, t("sent")))) onDone();
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        {t("template")}
        <select className="h-9 rounded-md border border-slate-300 px-3 text-sm" defaultValue="" onChange={(event) => setContent(canned.data?.find((item) => String(item.id) === event.target.value)?.content ?? content)}>
          <option value="">—</option>
          {(canned.data ?? []).map((item) => <option key={item.id} value={String(item.id)}>/{item.shortCode}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("message")}
        <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} maxLength={2000} required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <Button type="submit" loading={isPending} disabled={!parsed.success} className="self-start">{t("send")}</Button>
    </form>
  );
}

function CannedButton() {
  const t = useTranslations("admin.support");
  const tc = useTranslations("admin.common");
  return (
    <FormAction
      label={tc("new")}
      title={t("newCanned")}
      resources={["support-canned"]}
      schema={cannedSchema}
      initialValues={{ shortCode: "", content: "" }}
      fields={[
        { name: "shortCode", label: t("shortCode"), hint: t("shortCodeHint") },
        { name: "content", label: t("message"), type: "textarea" },
      ]}
      toRequest={(values) => ({ path: "/communication/support/canned", method: "POST", body: values })}
    />
  );
}

// ---------- NLU: entrenamiento continuo y precisión ----------
export function NluTab() {
  const t = useTranslations("admin.support");
  const format = useFormat();
  const metrics = useAdminGet<NluMetrics>("nlu-metrics", "/nlp/metrics", {}, { baseUrl: LLM_ADMIN.baseUrl });
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title={t("nluTitle")} description={t("nluHint")} />
      {metrics.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard label={t("trainingExamples")} value={format.number(metrics.data.examples)} />
          <KPICard label={t("intentAccuracy")} value={pct(metrics.data.intents.accuracy)} />
          <KPICard label={t("entityPrecision")} value={pct(metrics.data.entities.precision)} />
          <KPICard label={t("entityRecall")} value={pct(metrics.data.entities.recall)} />
        </div>
      )}
      <AdminResource<TrainingExample, typeof newExampleSchema, typeof labelSchema>
        resource="nlu-training"
        path="/nlp/training"
        baseUrl={LLM_ADMIN.baseUrl}
        title={t("trainingQueue")}
        invalidate={["nlu-metrics"]}
        rowLabel={(row) => row.text}
        filters={[{ name: "approved", label: t("state"), options: [{ value: "false", label: t("toReview") }, { value: "true", label: t("approved") }] }]}
        columns={[
          { key: "text", header: t("message"), cell: (row) => <span className="line-clamp-2">{row.text}</span> },
          { key: "intent", header: t("intent"), cell: (row) => `${t(`intents.${row.intent}`)}${row.confidence !== null ? ` · ${pct(row.confidence)}` : ""}` },
          { key: "entities", header: t("entities"), cell: (row) => row.entities.map((e) => `${e.label}: ${e.text}`).join(", ") || "—" },
          { key: "source", header: t("source"), cell: (row) => t(`sources.${row.source}`) },
          { key: "state", header: t("state"), cell: (row) => <StatusBadge status={row.approved ? "APPROVED" : "PENDING"} label={row.approved ? t("approved") : t("toReview")} /> },
        ]}
        create={{
          schema: newExampleSchema,
          initialValues: { text: "", intent: "product_search", entities: "" },
          fields: [
            { name: "text", label: t("message"), type: "textarea" },
            { name: "intent", label: t("intent"), type: "select", options: toOptions(INTENTS, (value) => t(`intents.${value}`)) },
            { name: "entities", label: t("entities"), hint: t("entitiesHint") },
          ],
          toBody: (values) => ({ text: values.text, intent: values.intent, entities: parseEntities(values.entities) }),
        }}
        edit={{
          schema: labelSchema,
          fields: [
            { name: "intent", label: t("intent"), type: "select", options: toOptions(INTENTS, (value) => t(`intents.${value}`)) },
            { name: "entities", label: t("entities"), hint: t("entitiesHint") },
            { name: "approved", label: t("approve"), type: "checkbox" },
          ],
          toValues: (row) => ({ intent: (INTENTS as readonly string[]).includes(row.intent) ? (row.intent as (typeof INTENTS)[number]) : "product_search", entities: row.entities.map((e) => `${e.label}: ${e.text}`).join(", "), approved: true }),
          toBody: (values) => ({ intent: values.intent, entities: parseEntities(values.entities), approved: values.approved }),
        }}
        remove
      />
    </div>
  );
}

const newExampleSchema = z.object({ text: z.string().trim().min(1, "validation.required").max(1000), intent: z.enum(INTENTS), entities: z.string().trim().max(500) });

// parseEntities => "PRODUCT: tenis negros, QUANTITY: 2" -> [{ label, text }] (formato simple para el asesor)
function parseEntities(raw: string): Array<{ label: string; text: string }> {
  return raw
    .split(",")
    .map((part) => part.split(":").map((value) => value.trim()))
    .filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1]))
    .map(([label, text]) => ({ label: label.toUpperCase(), text }));
}

// ---------- RF-21.2 mensajes del formulario de contacto ----------
interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  orderNumber: string | null;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED";
  reply: string | null;
  createdAt: string;
}
const CONTACT_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;
const CONTACT_TONE = { NEW: "PENDING", IN_PROGRESS: "SENT", RESOLVED: "APPROVED" } as const;
const contactReplySchema = z.object({ reply: z.string().trim().min(3, "validation.min3").max(5000), status: z.enum(CONTACT_STATUSES) });

export function ContactTab() {
  const t = useTranslations("admin.support");
  const format = useFormat();
  return (
    <AdminResource<ContactMessage, typeof contactReplySchema, typeof contactReplySchema>
      resource="contact-messages"
      path="/communication/contact"
      title={t("contactTitle")}
      rowLabel={(row) => row.name}
      filters={[{ name: "status", label: t("state"), options: toOptions(CONTACT_STATUSES, (v) => t(`contactStatuses.${v}`)) }]}
      columns={[
        { key: "date", header: t("date"), cell: (row) => format.dateTime(row.createdAt) },
        { key: "from", header: t("from"), cell: (row) => <span className="flex flex-col"><span className="font-medium">{row.name}</span><span className="text-xs text-slate-500">{row.email}</span></span> },
        { key: "topic", header: t("topic"), cell: (row) => `${t(`topics.${row.topic}`)}${row.orderNumber ? ` · ${row.orderNumber}` : ""}` },
        { key: "message", header: t("message"), cell: (row) => <span className="line-clamp-2 text-xs">{row.message}</span> },
        { key: "status", header: t("state"), cell: (row) => <StatusBadge status={CONTACT_TONE[row.status]} label={t(`contactStatuses.${row.status}`)} /> },
      ]}
      // Editar = responder por correo y cambiar el estado (PATCH /communication/contact/:id)
      edit={{
        schema: contactReplySchema,
        fields: [
          { name: "reply", label: t("reply"), type: "textarea" },
          { name: "status", label: t("state"), type: "select", options: toOptions(CONTACT_STATUSES, (v) => t(`contactStatuses.${v}`)) },
        ],
        toValues: (row) => ({ reply: row.reply ?? "", status: row.status === "NEW" ? "RESOLVED" : row.status }),
      }}
    />
  );
}
