// MarketingAdmin.tsx (Client Component) => marketing y correo: campañas por segmento (email/push/WhatsApp) con
// programación y métricas de apertura, bitácora de correos enviados (Nodemailer), plantillas con variables
// "{{ nombre }}" y cupones de descuento.
// Patrones: Composite (pestañas) + Command (enviar ahora / enviar correo). Ahorro: las campañas se envían por lotes
// desde el backend; el panel solo consulta la pestaña abierta.
"use client";

import { useTranslations } from "next-intl";
import { useAdminGet, useAdminList, type Campaign, type Coupon, type EmailLog, type EmailTemplate, type PointsMultiplier, type Promotion } from "../api/dashboard.api";
import { flattenTree } from "../lib/resources";
import { Button } from "@/shared/ui/Button";
import { AdminResource, DialogButton, FormAction, isoOrUndefined, toOptions, IconAction, useAdminCommand } from "./AdminResource";
import { EmailDesigner } from "./EmailDesigner"; // RF-21.6
import { AdminTabs } from "./AdminTabs";
import { StatusBadge } from "./OrdersAdmin";
import { campaignSchema, couponSchema, multiplierSchema, promotionSchema, sendEmailSchema, templateSchema } from "../lib/dashboard.validator";
import { useFormat } from "@/shared/hook/useFormat";

const CHANNELS = ["EMAIL", "PUSH", "WHATSAPP"] as const;
const AUDIENCES = ["ALL", "VIP", "REGULAR", "NEW", "INACTIVE"] as const;
const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "SENDING", "TESTING", "SENT", "FAILED", "ARCHIVED"] as const;
const EMAIL_STATUSES = ["QUEUED", "SENT", "FAILED"] as const;
const COUPON_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"] as const;
const couponEditSchema = couponSchema.omit({ code: true }); // El código no cambia al editar (los clientes ya lo tienen)

export function MarketingAdmin() {
  const t = useTranslations("admin.marketing");
  return (
    <AdminTabs
      section="marketing"
      label={t("tabs.label")}
      tabs={[
        { id: "campaigns", label: t("tabs.campaigns"), render: () => <CampaignsTab /> },
        { id: "emails", label: t("tabs.emails"), render: () => <EmailsTab /> },
        { id: "templates", label: t("tabs.templates"), render: () => <TemplatesTab /> },
        { id: "coupons", label: t("tabs.coupons"), render: () => <CouponsTab /> },
        { id: "promotions", label: t("tabs.promotions"), render: () => <PromotionsTab /> }, // RF-13.4/13.7/13.8/13.9
        { id: "multipliers", label: t("tabs.multipliers"), render: () => <MultipliersTab /> }, // RF-14.9
      ]}
    />
  );
}

// ---------- Campañas ----------
function CampaignsTab() {
  const t = useTranslations("admin.marketing");
  const format = useFormat();
  // RF-22.2 segmentos personalizados del CRM como audiencias adicionales
  const segments = useAdminList<{ id: string; name: string }>("crm-segments", "/crm/segment", {});
  const segmentOptions = (segments.data?.data ?? []).map((segment) => ({ value: `SEGMENT:${segment.id}`, label: `${t("customSegment")}: ${segment.name}` }));
  const audienceLabel = (value: string) => (value.startsWith("SEGMENT:") ? (segmentOptions.find((o) => o.value === value)?.label ?? t("customSegment")) : t(`audiences.${value}`));
  const fields = [
    { name: "name", label: t("name") },
    { name: "channel", label: t("channel"), type: "select" as const, options: toOptions(CHANNELS, (value) => t(`channels.${value}`)) },
    { name: "audience", label: t("audience"), type: "select" as const, options: [...toOptions(AUDIENCES, (value) => t(`audiences.${value}`)), ...segmentOptions] },
    { name: "subject", label: t("subject") },
    { name: "content", label: t("content"), type: "textarea" as const, hint: t("contentHint") },
    { name: "scheduledAt", label: t("scheduledAt"), type: "datetime-local" as const, hint: t("scheduleHint") },
    { name: "cost", label: t("cost"), type: "number" as const, hint: t("costHint") },
    { name: "abEnabled", label: t("abEnabled"), type: "checkbox" as const, hint: t("abHint") },
    { name: "subjectB", label: t("subjectB") },
    { name: "contentB", label: t("contentB"), type: "textarea" as const, hint: t("contentBHint") },
    { name: "testPercent", label: t("testPercent"), type: "number" as const },
    { name: "abMetric", label: t("abMetric"), type: "select" as const, options: toOptions(["OPEN", "CLICK"], (value) => t(`abMetrics.${value}`)) },
    { name: "waitHours", label: t("waitHours"), type: "number" as const },
  ];
  // toBody => fecha local -> ISO UTC; campos A/B -> objeto "abTest" (o null si no aplica) y costo en centavos
  const toBody = (values: { scheduledAt?: string | undefined; cost: number; abEnabled: boolean; subjectB?: string | undefined; contentB?: string | undefined; testPercent: number; abMetric: "OPEN" | "CLICK"; waitHours: number; [key: string]: unknown }) => {
    const { cost, abEnabled, subjectB, contentB, testPercent, abMetric, waitHours, ...rest } = values;
    return {
      ...rest,
      scheduledAt: isoOrUndefined(values.scheduledAt),
      costCents: cost,
      abTest: abEnabled && subjectB ? { subjectB, ...(contentB ? { contentB } : {}), testPercent, metric: abMetric, waitHours } : null,
    };
  };
  const editable = (row: Campaign) => row.status === "DRAFT" || row.status === "SCHEDULED"; // Lo enviado no se edita
  return (
    <AdminResource<Campaign, typeof campaignSchema, typeof campaignSchema>
      resource="campaigns"
      path="/marketing/campaign"
      title={t("tabs.campaigns")}
      rowLabel={(row) => row.name}
      filters={[
        { name: "status", label: t("status"), options: toOptions(CAMPAIGN_STATUSES, (value) => t(`campaignStatus.${value}`)) },
        { name: "channel", label: t("channel"), options: toOptions(CHANNELS, (value) => t(`channels.${value}`)) },
      ]}
      columns={[
        { key: "name", header: t("name"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "channel", header: t("channel"), cell: (row) => t(`channels.${row.channel}`) },
        { key: "audience", header: t("audience"), cell: (row) => audienceLabel(row.audience) },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={t(`campaignStatus.${row.status}`)} /> },
        { key: "sent", header: t("sent"), cell: (row) => `${row.metrics.sent}/${row.metrics.targeted}`, className: "text-right tabular-nums" },
        { key: "open", header: t("openRate"), cell: (row) => `${(row.metrics.openRate * 100).toFixed(1)} %`, className: "text-right tabular-nums" },
        { key: "click", header: t("clickRate"), cell: (row) => `${(row.metrics.clickRate * 100).toFixed(1)} %`, className: "text-right tabular-nums" },
        { key: "conv", header: t("conversions"), cell: (row) => `${row.metrics.conversions} · ${format.money(row.metrics.revenueCents)}`, className: "text-right tabular-nums" },
        { key: "roi", header: t("roi"), cell: (row) => (row.metrics.roi === null ? "—" : `${(row.metrics.roi * 100).toFixed(0)} %`), className: "text-right tabular-nums" },
        { key: "ab", header: t("abTest"), cell: (row) => (row.abTest ? (row.abTest.winner ? t("abWinner", { variant: row.abTest.winner }) : t("abRunning")) : "—") },
        { key: "date", header: t("scheduledAt"), cell: (row) => (row.sentAt ?? row.scheduledAt ? format.dateTime((row.sentAt ?? row.scheduledAt) as string) : "—") },
      ]}
      // "Enviar ahora" => PATCH { sendNow: true } (Command); solo para borradores y programadas
      actions={(row, run) =>
        (
          <IconAction icon="send" disabled={!editable(row)} label={`${t("sendNow")} ${row.name}`} onClick={() => window.confirm(t("confirmSend", { name: row.name })) && void run({ path: `/marketing/campaign/${row.id}`, method: "PATCH", body: { sendNow: true } }, t("sending"))} />
        )
      }
      create={{ schema: campaignSchema, fields, toBody, initialValues: { name: "", channel: "EMAIL", audience: "ALL", subject: "", content: "", scheduledAt: "", cost: 0, abEnabled: false, subjectB: "", contentB: "", testPercent: 20, abMetric: "OPEN", waitHours: 4 } }}
      edit={{
        schema: campaignSchema,
        fields,
        toBody,
        when: editable,
        toValues: (row) => ({
          name: row.name,
          channel: row.channel,
          audience: row.audience,
          subject: row.subject,
          content: row.content,
          scheduledAt: row.scheduledAt?.slice(0, 16) ?? "",
          cost: row.costCents / 100,
          abEnabled: Boolean(row.abTest),
          subjectB: row.abTest?.subjectB ?? "",
          contentB: row.abTest?.contentB ?? "",
          testPercent: row.abTest?.testPercent ?? 20,
          abMetric: row.abTest?.metric ?? "OPEN",
          waitHours: row.abTest?.waitHours ?? 4,
        }),
      }}
      remove
    />
  );
}

// ---------- Correos enviados ----------
function EmailsTab() {
  const t = useTranslations("admin.marketing");
  const format = useFormat();
  // Plantillas para el selector del envío manual (misma clave de caché que la pestaña Plantillas: sin doble petición)
  const templates = useAdminList<EmailTemplate>("templates", "/email/template", { page: 1, limit: 100 });
  return (
    <AdminResource<EmailLog>
      resource="emails"
      path="/email"
      title={t("tabs.emails")}
      search="to"
      rowLabel={(row) => row.to}
      filters={[{ name: "status", label: t("status"), options: toOptions(EMAIL_STATUSES, (value) => t(`emailStatus.${value}`)) }]}
      toolbar={
        <FormAction
          variant="primary"
          label={t("sendEmail")}
          title={t("sendEmail")}
          resources={["emails"]}
          submitLabel={t("send")}
          success={t("emailQueued")}
          schema={sendEmailSchema}
          initialValues={{ to: "", templateId: "", variables: "" }}
          fields={[
            { name: "to", label: t("to"), type: "email" },
            { name: "templateId", label: t("template"), type: "select", options: [{ value: "", label: "—" }, ...(templates.data?.data ?? []).map((item) => ({ value: item.id, label: item.name }))] },
            { name: "variables", label: t("variables"), hint: t("variablesHint") },
          ]}
          toRequest={(values) => ({ path: "/email/send", method: "POST", body: values })}
        />
      }
      columns={[
        { key: "to", header: t("to"), cell: (row) => row.to },
        { key: "subject", header: t("subject"), cell: (row) => row.subject },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={t(`emailStatus.${row.status}`)} /> },
        { key: "opens", header: t("opens"), cell: (row) => row.openCount, className: "text-right tabular-nums" },
        { key: "clicks", header: t("clicks"), cell: (row) => `${row.clickCount}${row.convertedAt ? " · ✓" : ""}`, className: "text-right tabular-nums" },
        { key: "date", header: t("date"), cell: (row) => format.dateTime(row.createdAt) },
      ]}
    />
  );
}

// ---------- Plantillas ----------
function TemplatesTab() {
  const t = useTranslations("admin.marketing");
  const fields = [
    { name: "name", label: t("name") },
    { name: "subject", label: t("subject") },
    { name: "html", label: t("html"), type: "textarea" as const, hint: t("htmlHint") },
  ];
  return (
    <AdminResource<EmailTemplate, typeof templateSchema, typeof templateSchema>
      resource="templates"
      path="/email/template"
      title={t("tabs.templates")}
      rowLabel={(row) => row.name}
      // RF-21.6 diseñador visual: crear o editar con bloques (arrastrar y soltar)
      toolbar={
        <DialogButton variant="primary" label={t("designer.new")} title={t("designer.new")}>
          {(close) => <EmailDesigner onDone={close} />}
        </DialogButton>
      }
      actions={(row) => (
        <DialogButton icon="template" label={`${t("designer.edit")} ${row.name}`} title={`${t("designer.edit")} · ${row.name}`}>
          {(close) => <EmailDesigner template={{ id: row.id, name: row.name, subject: row.subject, blocks: row.blocks }} onDone={close} />}
        </DialogButton>
      )}
      columns={[
        { key: "name", header: t("name"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "subject", header: t("subject"), cell: (row) => row.subject },
        { key: "kind", header: t("designer.kind"), cell: (row) => (row.blocks ? t("designer.visual") : "HTML") },
        { key: "vars", header: t("variables"), cell: (row) => row.variables.map((name) => `{{ ${name} }}`).join(" ") || "—" },
        { key: "locale", header: t("locale"), cell: (row) => row.locale.toUpperCase() },
      ]}
      create={{ schema: templateSchema, fields, initialValues: { name: "", subject: "", html: "" } }}
      edit={{ schema: templateSchema, fields, toValues: (row) => ({ name: row.name, subject: row.subject, html: row.html }) }}
      remove
    />
  );
}

// useScopeOptions => opciones de alcance (categorías en árbol aplanado, marcas, colecciones) compartidas por cupones y
// promociones (DRY; misma clave de caché que Productos: sin peticiones extra)
function useScopeOptions() {
  const categories = useAdminGet<unknown>("categories", "/category");
  const brands = useAdminGet<Array<{ id: string; name: string }>>("brands", "/brand", { limit: 100 });
  const collections = useAdminGet<Array<{ id: string; name: string }>>("collections", "/collection", { limit: 100 });
  return {
    categories: flattenTree(categories.data).map((row) => ({ value: String(row["id"]), label: String(row["name"]) })),
    brands: (brands.data ?? []).map((row) => ({ value: row.id, label: row.name })),
    collections: (Array.isArray(collections.data) ? collections.data : []).map((row) => ({ value: row.id, label: row.name })),
  };
}
const TIERS = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"] as const;

// ---------- Cupones ----------
function CouponsTab() {
  const t = useTranslations("admin.marketing");
  const format = useFormat();
  const scope = useScopeOptions();
  const fields = [
    { name: "code", label: t("code") },
    { name: "type", label: t("couponType"), type: "select" as const, options: toOptions(COUPON_TYPES, (value) => t(`couponTypes.${value}`)) },
    { name: "value", label: t("value"), type: "number" as const, hint: t("valueHint") },
    { name: "usageLimit", label: t("usageLimit"), type: "number" as const },
    { name: "endsAt", label: t("endsAt"), type: "date" as const },
    // RF-13.2 alcance: categorías, marcas y segmento por nivel de fidelidad (vacío = toda la tienda)
    { name: "categoryIds", label: t("scopeCategories"), type: "checkboxes" as const, options: scope.categories },
    { name: "brandIds", label: t("scopeBrands"), type: "checkboxes" as const, options: scope.brands },
    { name: "segments", label: t("scopeSegments"), type: "checkboxes" as const, options: toOptions(TIERS, (value) => t(`tiers.${value}`)) },
  ];
  // toBody => "monto fijo" se escribe en pesos y viaja en centavos; porcentaje y envío gratis van tal cual
  const toBody = (values: { type: string; value: number; endsAt?: string | undefined }) => ({
    ...values,
    value: values.type === "FIXED_AMOUNT" ? values.value * 100 : values.value,
    endsAt: values.endsAt ? new Date(`${values.endsAt}T23:59:59`).toISOString() : undefined,
  });
  return (
    <AdminResource<Coupon, typeof couponSchema, typeof couponEditSchema>
      resource="coupons"
      path="/coupon"
      title={t("tabs.coupons")}
      rowLabel={(row) => row.code}
      filters={[{ name: "active", label: t("status"), options: [{ value: "true", label: t("active") }, { value: "false", label: t("inactive") }] }]}
      columns={[
        { key: "code", header: t("code"), cell: (row) => <code className="font-semibold">{row.code}</code> },
        { key: "type", header: t("couponType"), cell: (row) => t(`couponTypes.${row.type}`) },
        { key: "value", header: t("value"), cell: (row) => (row.type === "PERCENTAGE" ? `${row.value} %` : row.type === "FIXED_AMOUNT" ? format.money(row.value) : "—"), className: "text-right" },
        { key: "used", header: t("used"), cell: (row) => `${row.usedCount}${row.usageLimit ? ` / ${row.usageLimit}` : ""}`, className: "text-right tabular-nums" },
        { key: "ends", header: t("endsAt"), cell: (row) => (row.endsAt ? format.date(row.endsAt) : "—") },
        { key: "scope", header: t("scope"), cell: (row) => (row.categoryIds.length + row.brandIds.length + row.productIds.length + row.segments.length > 0 ? t("scoped") : t("allStore")) },
        { key: "origin", header: t("origin"), cell: (row) => t(`origins.${row.origin}`) },
      ]}
      create={{ schema: couponSchema, fields, toBody, initialValues: { code: "", type: "PERCENTAGE", value: 10, usageLimit: "", endsAt: "", productIds: [], categoryIds: [], brandIds: [], segments: [] } }}
      edit={{
        schema: couponEditSchema,
        fields: fields.slice(1),
        toBody,
        toValues: (row) => ({ type: row.type, value: row.type === "FIXED_AMOUNT" ? row.value / 100 : row.value, usageLimit: row.usageLimit ?? "", endsAt: row.endsAt?.slice(0, 10) ?? "", productIds: row.productIds, categoryIds: row.categoryIds, brandIds: row.brandIds, segments: row.segments }),
      }}
      remove
    />
  );
}

// toLocalInput / fromLocal => fecha ISO <-> "YYYY-MM-DDTHH:mm" de <input type="datetime-local">
const toLocalInput = (iso: string) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
// parseTiers => "2:10, 4:20" -> [{ minQty: 2, percent: 10 }, ...] (Adapter del texto del formulario)
const parseTiers = (text?: string) => (text ?? "").split(",").map((pair) => pair.split(":").map((part) => Number(part.trim()))).filter(([minQty, percent]) => minQty && percent).map(([minQty, percent]) => ({ minQty, percent }));

// ---------- RF-13 Promociones automáticas ----------
const PROMOTION_TYPES = ["BUY_X_PAY_Y", "PERCENT_OFF", "TIERED", "FLASH"] as const;
function PromotionsTab() {
  const t = useTranslations("admin.marketing");
  const format = useFormat();
  const scope = useScopeOptions();
  const seasonal = useAdminCommand(["promotions"]);
  const fields = [
    { name: "name", label: t("name") },
    { name: "type", label: t("promotionType"), type: "select" as const, options: toOptions(PROMOTION_TYPES, (value) => t(`promotionTypes.${value}`)) },
    { name: "buyQuantity", label: t("buyQuantity"), type: "number" as const, hint: t("buyPayHint") },
    { name: "payQuantity", label: t("payQuantity"), type: "number" as const },
    { name: "percent", label: t("percent"), type: "number" as const },
    { name: "tiers", label: t("tiersRule"), hint: t("tiersHint") },
    { name: "categoryIds", label: t("scopeCategories"), type: "checkboxes" as const, options: scope.categories },
    { name: "brandIds", label: t("scopeBrands"), type: "checkboxes" as const, options: scope.brands },
    { name: "collectionIds", label: t("scopeCollections"), type: "checkboxes" as const, options: scope.collections },
    { name: "priority", label: t("priority"), type: "number" as const, hint: t("priorityHint") },
    { name: "stackable", label: t("stackable"), type: "checkbox" as const },
    { name: "startsAt", label: t("startsAt"), type: "datetime-local" as const },
    { name: "endsAt", label: t("endsAt"), type: "datetime-local" as const },
  ];
  const toBody = (values: { tiers?: string | undefined; startsAt: string; endsAt: string }) => ({ ...values, tiers: parseTiers(values.tiers), startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString() });
  return (
    <AdminResource<Promotion, typeof promotionSchema, typeof promotionSchema>
      resource="promotions"
      path="/promotion"
      title={t("tabs.promotions")}
      rowLabel={(row) => row.name}
      toolbar={
        // RF-13.9 crea Black Friday y Cyber Monday del año (idempotente: no duplica)
        <Button size="sm" variant="secondary" loading={seasonal.isPending} onClick={() => void seasonal.run({ path: "/promotion/seasonal", method: "POST", body: {} }, t("seasonalCreated"))}>{t("seasonal")}</Button>
      }
      columns={[
        { key: "name", header: t("name"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "type", header: t("promotionType"), cell: (row) => t(`promotionTypes.${row.type}`) },
        { key: "rule", header: t("rule"), cell: (row) => (row.type === "BUY_X_PAY_Y" ? `${row.buyQuantity}x${row.payQuantity}` : row.type === "TIERED" ? (row.tiers ?? []).map((tier) => `${tier.minQty}+ → ${tier.percent} %`).join(" · ") : `${row.percent} %`) },
        { key: "priority", header: t("priority"), cell: (row) => `${row.priority}${row.stackable ? " · +" : ""}`, className: "tabular-nums" },
        { key: "dates", header: t("validity"), cell: (row) => `${format.dateTime(row.startsAt)} – ${format.dateTime(row.endsAt)}` },
        { key: "active", header: t("status"), cell: (row) => <StatusBadge status={row.isActive ? "APPROVED" : "CANCELLED"} label={row.isActive ? t("active") : t("inactive")} /> },
      ]}
      actions={(row, run) => <IconAction icon={row.isActive ? "archive" : "check"} label={`${row.isActive ? t("deactivate") : t("activate")} ${row.name}`} onClick={() => void run({ path: `/promotion/${row.id}`, method: "PATCH", body: { isActive: !row.isActive } }, t("saved"))} />}
      create={{ schema: promotionSchema, fields, toBody, initialValues: { name: "", type: "BUY_X_PAY_Y", buyQuantity: 2, payQuantity: 1, percent: "", tiers: "", categoryIds: [], brandIds: [], collectionIds: [], priority: 0, stackable: false, startsAt: toLocalInput(new Date().toISOString()), endsAt: "" } }}
      edit={{
        schema: promotionSchema,
        fields,
        toBody,
        toValues: (row) => ({ name: row.name, type: row.type, buyQuantity: row.buyQuantity ?? "", payQuantity: row.payQuantity ?? "", percent: row.percent ?? "", tiers: (row.tiers ?? []).map((tier) => `${tier.minQty}:${tier.percent}`).join(", "), categoryIds: row.categoryIds, brandIds: row.brandIds, collectionIds: row.collectionIds, priority: row.priority, stackable: row.stackable, startsAt: toLocalInput(row.startsAt), endsAt: toLocalInput(row.endsAt) }),
      }}
    />
  );
}

// ---------- RF-14.9 Multiplicadores de puntos ----------
function MultipliersTab() {
  const t = useTranslations("admin.marketing");
  const format = useFormat();
  const fields = [
    { name: "name", label: t("name") },
    { name: "multiplier", label: t("multiplier"), type: "number" as const, hint: t("multiplierHint") },
    { name: "startsAt", label: t("startsAt"), type: "datetime-local" as const },
    { name: "endsAt", label: t("endsAt"), type: "datetime-local" as const },
  ];
  return (
    <AdminResource<PointsMultiplier, typeof multiplierSchema, typeof multiplierSchema>
      resource="multipliers"
      path="/loyalty/multiplier"
      title={t("tabs.multipliers")}
      rowLabel={(row) => row.name}
      columns={[
        { key: "name", header: t("name"), cell: (row) => <span className="font-medium">{row.name}</span> },
        { key: "multiplier", header: t("multiplier"), cell: (row) => `x${row.multiplier}`, className: "tabular-nums" },
        { key: "dates", header: t("validity"), cell: (row) => `${format.dateTime(row.startsAt)} – ${format.dateTime(row.endsAt)}` },
        { key: "active", header: t("status"), cell: (row) => <StatusBadge status={row.isActive ? "APPROVED" : "CANCELLED"} label={row.isActive ? t("active") : t("inactive")} /> },
      ]}
      actions={(row, run) => <IconAction icon={row.isActive ? "archive" : "check"} label={`${row.isActive ? t("deactivate") : t("activate")} ${row.name}`} onClick={() => void run({ path: `/loyalty/multiplier/${row.id}`, method: "PATCH", body: { isActive: !row.isActive } }, t("saved"))} />}
      create={{ schema: multiplierSchema, fields, toBody: (values: { startsAt: string; endsAt: string }) => ({ ...values, startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString() }), initialValues: { name: "", multiplier: 2, startsAt: toLocalInput(new Date().toISOString()), endsAt: "" } }}
    />
  );
}
