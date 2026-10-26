// SettingsAdmin.tsx (Client Component) => "Equipo e integraciones": roles y permisos del equipo (RBAC), avisos a otros
// sistemas (webhooks firmados con HMAC), automatizaciones (flujos n8n) e historial de actividad (auditoría Winston +
// MongoDB). Cada pestaña lleva un texto que explica PARA QUÉ sirve en lenguaje de negocio (el comerciante no tiene por
// qué conocer "webhook" o "n8n"). Las acciones del asistente IA (transacciones MCP) se muestran en "Asistente IA" y
// los pagos/envíos en "Configuración" del menú (mismo panel, servido por Nuxt).
// Patrones: Composite (pestañas) + Command (probar webhook, ejecutar flujo, rollback) + Guard (Express vuelve a
// validar el rol ADMIN en cada petición: la UI nunca es la única barrera).
"use client";

import { useTranslations } from "next-intl";
import { useAdminList, type McpTransaction, type Permission, type Role, type WebhookEndpoint, type Workflow } from "../api/dashboard.api";
import { AdminResource, FormAction, toOptions, IconAction } from "./AdminResource";
import { AdminTabs } from "./AdminTabs";
import { StatusBadge } from "./OrdersAdmin";
import { PERMISSION_ACTIONS, permissionSchema, permissionUpdateSchema, roleSchema, rollbackSchema, TRIGGER_TYPES, webhookSchema, workflowSchema } from "../lib/dashboard.validator";
import { useFormat } from "@/shared/hook/useFormat";
import { Badge } from "@/shared/ui/Badge";
import { HealthTab, TemplatesTab } from "./AutomationHealth"; // RF-20.2 / RF-20.7
import { AuditInsightsTab, AuditTab } from "./AuditCenter"; // RF-30.2/30.3/30.4/30.6/30.7/30.8

// Eventos de dominio que Express publica (mismos nombres que AUTOMATION_EVENTS / WEBHOOK_EVENTS del backend)
const COMMERCE_EVENTS = ["order.placed", "order.status-changed", "order.cancelled", "payment.failed", "shipment.updated", "refund.updated", "invoice.issued", "loyalty.tier-upgraded", "review.moderated"] as const;
const EVENTS = [...COMMERCE_EVENTS, "inventory.low", "inventory.adjusted", "customer.inactive"] as const; // RF-20.2 / 20.8
const WEBHOOK_EVENTS = [...COMMERCE_EVENTS, "inventory.low", "cms.updated"] as const;
const MCP_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "COMPENSATING", "COMPENSATED", "FAILED", "CANCELLED"] as const;

export function SettingsAdmin() {
  const t = useTranslations("admin.settings");
  return (
    <AdminTabs
      section="settings"
      label={t("tabs.label")}
      tabs={[
        // "description" => ayuda visible bajo las pestañas (admin.settings.help.*)
        { id: "roles", label: t("tabs.roles"), description: t("help.roles"), render: () => <RolesTab /> },
        { id: "permissions", label: t("tabs.permissions"), description: t("help.permissions"), render: () => <PermissionsTab /> },
        { id: "webhooks", label: t("tabs.webhooks"), description: t("help.webhooks"), render: () => <WebhooksTab /> },
        { id: "automation", label: t("tabs.automation"), description: t("help.automation"), render: () => <AutomationTab /> },
        { id: "automation-health", label: t("tabs.automationHealth"), description: t("help.automationHealth"), render: () => <HealthTab /> },
        { id: "automation-templates", label: t("tabs.automationTemplates"), description: t("help.automationTemplates"), render: () => <TemplatesTab /> },
        { id: "audit", label: t("tabs.audit"), description: t("help.audit"), render: () => <AuditTab /> },
        { id: "audit-insights", label: t("tabs.auditInsights"), description: t("help.auditInsights"), render: () => <AuditInsightsTab /> },
      ]}
    />
  );
}

// ---------- Roles ----------
function RolesTab() {
  const t = useTranslations("admin.settings");
  // Catálogo de permisos para las casillas (misma clave que la pestaña Permisos: TanStack Query no repite la petición)
  const permissions = useAdminList<Permission>("permissions", "/permission", { page: 1, limit: 100 });
  const options = (permissions.data?.data ?? []).map((item) => ({ value: item.id, label: `${item.action} · ${item.resource}` }));
  // RF-03.1 jerarquía: el rol padre se elige entre los roles existentes (Express rechaza ciclos)
  const roles = useAdminList<Role>("roles", "/role", { page: 1, limit: 100 });
  const parents = [{ value: "", label: t("none") }, ...(roles.data?.data ?? []).map((role) => ({ value: role.id, label: role.name }))];
  const fields = [
    { name: "name", label: t("roleName"), hint: t("roleHint") },
    { name: "description", label: t("description"), type: "textarea" as const },
    { name: "parentId", label: t("parentRole"), type: "select" as const, options: parents, hint: t("parentHint") },
    { name: "permissionIds", label: t("tabs.permissions"), type: "checkboxes" as const, options },
  ];
  const system = (row: Role) => ["ADMIN", "CUSTOMER"].includes(row.name); // Roles base: no se borran desde la UI
  return (
    <AdminResource<Role, typeof roleSchema, typeof roleSchema>
      resource="roles"
      path="/role"
      title={t("tabs.roles")}
      invalidate={["permissions"]}
      rowLabel={(row) => row.name}
      columns={[
        { key: "name", header: t("roleName"), cell: (row) => <code className="font-semibold">{row.name}</code> },
        { key: "description", header: t("description"), cell: (row) => row.description ?? "—" },
        { key: "parent", header: t("parentRole"), cell: (row) => row.parentName ?? "—" },
        { key: "permissions", header: t("tabs.permissions"), cell: (row) => row.permissions.length, className: "text-right tabular-nums" },
      ]}
      create={{ schema: roleSchema, fields, initialValues: { name: "", description: "", permissionIds: [], parentId: "" } }}
      edit={{ schema: roleSchema, fields, toValues: (row) => ({ name: row.name, description: row.description ?? "", permissionIds: row.permissions.map((item) => item.id), parentId: row.parentId ?? "" }) }}
      remove={(row) => !system(row)}
    />
  );
}

// ---------- Permisos ----------
function PermissionsTab() {
  const t = useTranslations("admin.settings");
  return (
    <AdminResource<Permission & { description?: string | null }, typeof permissionSchema, typeof permissionUpdateSchema>
      resource="permissions"
      path="/permission"
      title={t("tabs.permissions")}
      invalidate={["roles"]}
      rowLabel={(row) => `${row.action} ${row.resource}`}
      columns={[
        { key: "action", header: t("action"), cell: (row) => <Badge>{row.action}</Badge> },
        { key: "resource", header: t("resource"), cell: (row) => <code>{row.resource}</code> },
        { key: "description", header: t("description"), cell: (row) => row.description ?? "—" },
      ]}
      create={{
        schema: permissionSchema,
        initialValues: { action: "READ", resource: "", description: "" },
        fields: [
          { name: "action", label: t("action"), type: "select", options: toOptions(PERMISSION_ACTIONS) },
          { name: "resource", label: t("resource"), hint: t("resourceHint") },
          { name: "description", label: t("description"), type: "textarea" as const },
        ],
      }}
      // Acción y recurso son la identidad del permiso (los guards los usan): solo se edita la descripción
      edit={{ schema: permissionUpdateSchema, toValues: (row) => ({ description: row.description ?? "" }), fields: [{ name: "description", label: t("description"), type: "textarea" }] }}
      remove
    />
  );
}

// ---------- Webhooks ----------
function WebhooksTab() {
  const t = useTranslations("admin.settings");
  const fields = [
    { name: "name", label: t("name") },
    { name: "url", label: t("url"), type: "url" as const, hint: t("urlHint") },
    { name: "events", label: t("events"), type: "checkboxes" as const, options: toOptions(WEBHOOK_EVENTS) },
    { name: "maxAttempts", label: t("maxAttempts"), type: "number" as const },
    { name: "active", label: t("active"), type: "checkbox" as const },
  ];
  return (
    <AdminResource<WebhookEndpoint, typeof webhookSchema, typeof webhookSchema>
      resource="webhooks"
      path="/webhook"
      title={t("tabs.webhooks")}
      rowLabel={(row) => row.name}
      columns={[
        { key: "name", header: t("name"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "url", header: t("url"), cell: (row) => <span className="break-all text-xs">{row.url}</span> },
        { key: "events", header: t("events"), cell: (row) => row.events.length, className: "text-right" },
        { key: "rate", header: t("successRate"), cell: (row) => `${(row.metrics.successRate * 100).toFixed(0)} % · ${row.metrics.deliveries}`, className: "text-right tabular-nums" },
        { key: "active", header: t("active"), cell: (row) => (row.active ? t("yes") : t("no")) },
      ]}
      // "Probar" => entrega un evento webhook.test firmado (rate limit en Express: 10/min)
      actions={(row, run) => (
        <IconAction icon="send" label={`${t("test")} ${row.name}`} onClick={() => void run({ path: "/webhook/execution", method: "POST", body: { webhookId: row.id, payload: { ping: true } } }, t("testSent"))} />
      )}
      create={{ schema: webhookSchema, fields, initialValues: { name: "", url: "", events: [], maxAttempts: 5, active: true } }}
      edit={{ schema: webhookSchema, fields, toValues: (row) => ({ name: row.name, url: row.url, events: row.events, maxAttempts: row.maxAttempts, active: row.active }) }}
      remove
    />
  );
}

// ---------- Automatización n8n ----------
function AutomationTab() {
  const t = useTranslations("admin.settings");
  const format = useFormat();
  const fields = [
    { name: "name", label: t("name") },
    { name: "description", label: t("description"), type: "textarea" as const },
    { name: "triggerType", label: t("trigger"), type: "select" as const, options: toOptions(TRIGGER_TYPES, (value) => t(`triggers.${value}`)) },
    { name: "event", label: t("event"), type: "select" as const, options: [{ value: "", label: "—" }, ...toOptions(EVENTS)], hint: t("eventHint") },
    { name: "webhookPath", label: t("webhookPath"), hint: t("webhookPathHint") },
    { name: "active", label: t("active"), type: "checkbox" as const },
  ];
  return (
    <AdminResource<Workflow & { description?: string | null; webhookPath?: string }, typeof workflowSchema, typeof workflowSchema>
      resource="workflows"
      path="/automation"
      title={t("tabs.automation")}
      rowLabel={(row) => row.name}
      columns={[
        { key: "name", header: t("name"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "trigger", header: t("trigger"), cell: (row) => `${t(`triggers.${row.triggerType}`)}${row.event ? ` · ${row.event}` : ""}` },
        { key: "runs", header: t("runs"), cell: (row) => `${row.metrics.runs} · ${(row.metrics.successRate * 100).toFixed(0)} %`, className: "text-right tabular-nums" },
        { key: "last", header: t("lastRun"), cell: (row) => (row.lastRunAt ? format.dateTime(row.lastRunAt) : "—") },
        { key: "active", header: t("active"), cell: (row) => (row.active ? t("yes") : t("no")) },
      ]}
      actions={(row, run) =>
        (
          <IconAction icon="play" disabled={!row.active} label={`${t("run")} ${row.name}`} onClick={() => void run({ path: `/automation/${row.id}/run`, method: "POST", body: { payload: {} } }, t("runStarted"))} />
        )
      }
      create={{ schema: workflowSchema, fields, initialValues: { name: "", description: "", triggerType: "EVENT", event: "order.placed", webhookPath: "", active: true } }}
      edit={{
        schema: workflowSchema,
        fields,
        toValues: (row) => ({ name: row.name, description: row.description ?? "", triggerType: row.triggerType as (typeof TRIGGER_TYPES)[number], event: row.event ?? "", webhookPath: row.webhookPath ?? "", active: row.active }),
      }}
      remove
    />
  );
}

// ---------- Acciones del asistente IA (transacciones MCP con compensación Saga) ----------
// "export" => se muestra en la sección "Asistente IA" (AiAssistantAdmin), donde el usuario busca lo que hizo el asistente
export function McpTab() {
  const t = useTranslations("admin.settings");
  const format = useFormat();
  const canRollback = (row: McpTransaction) => row.status === "COMPLETED" || row.status === "FAILED";
  return (
    <AdminResource<McpTransaction>
      resource="mcp"
      path="/mcp"
      title={t("tabs.mcp")}
      rowLabel={(row) => row.type}
      filters={[{ name: "status", label: t("status"), options: toOptions(MCP_STATUSES, (value) => t(`mcpStatus.${value}`)) }]}
      columns={[
        { key: "type", header: t("type"), cell: (row) => <code>{row.type}</code> },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={t(`mcpStatus.${row.status}`)} /> },
        { key: "steps", header: t("steps"), cell: (row) => row.steps.map((step) => `${step.name}: ${step.status}`).join(" → ") },
        { key: "date", header: t("date"), cell: (row) => format.dateTime(row.createdAt) },
      ]}
      actions={(row) =>
        (
          <FormAction
            icon="undo"
            disabled={!canRollback(row)}
            label={t("rollback")}
            title={t("rollbackTitle", { type: row.type })}
            resources={["mcp"]}
            schema={rollbackSchema}
            initialValues={{ reason: "" }}
            fields={[{ name: "reason", label: t("reason") }]}
            toRequest={(values) => ({ path: `/mcp/${row.id}/rollback`, method: "POST", body: values })}
          />
        )
      }
    />
  );
}
