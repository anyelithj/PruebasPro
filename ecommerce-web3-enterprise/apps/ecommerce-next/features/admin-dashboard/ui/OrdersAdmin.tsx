// OrdersAdmin.tsx (Client Component) => operación de ventas en una sola sección con pestañas: pedidos (cambio de
// estado), envíos (guía y rastreo), facturas (PDF y nota crédito) y devoluciones (aprobar/rechazar).
// Patrones: Composite (cada pestaña es una configuración de AdminResource) + Strategy (badge por estado).
// Ahorro: AdminTabs monta solo la pestaña activa => las otras tres no consultan la API hasta abrirse.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Invoice, Refund, Shipment } from "../api/dashboard.api";
import { downloadAuthed } from "../api/dashboard.api";
import { AdminResource, toOptions, IconAction } from "./AdminResource";
import { NewOrderButton } from "./NewOrderForm";
import { AdminTabs } from "./AdminTabs";
import { creditNoteSchema, inspectionSchema, invoiceSchema, ORDER_STATUSES, orderStatusSchema, REFUND_STATUSES, refundReviewSchema, resolutionSchema, returnStatusSchema, SHIPMENT_STATUSES, shipmentUpdateSchema, voidInvoiceSchema } from "../lib/dashboard.validator";
import type { DianResolution } from "../api/dashboard.api";
import { useAdminGet } from "../api/dashboard.api";
import { FormAction } from "./AdminResource";
import type { OrderSummary } from "@/entities/order/model/order.types";
import { useFormat } from "@/shared/hook/useFormat";
import { useAuth } from "@/shared/hook/useAuth";
import { Badge } from "@/shared/ui/Badge";
import { toast } from "@/shared/ui/Toast";

// TONE => Strategy de color por estado (el texto acompaña siempre al color: no depende solo de él, WCAG 1.4.1)
const TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  DELIVERED: "success",
  APPROVED: "success",
  PROCESSED: "success",
  ISSUED: "success",
  ACCEPTED: "success",
  CANCELLED: "danger",
  REJECTED: "danger",
  RETURNED: "danger",
  FAILED: "danger",
  REQUESTED: "warning",
  PENDING: "warning",
  SENT: "success",
  COMPLETED: "success",
  COMPENSATED: "warning",
  QUEUED: "warning",
  SCHEDULED: "info",
  SENDING: "info",
  RUNNING: "info",
  SHIPPED: "info",
  IN_TRANSIT: "info",
  OUT_FOR_DELIVERY: "info",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{label}</Badge>;
}

export function OrdersAdmin() {
  const t = useTranslations("admin.orders");
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN"); // VENDOR: solo pedidos y envíos (RolePolicies.VENDOR); facturas y devoluciones son de ADMIN
  return (
    <AdminTabs
      section="orders"
      label={t("tabs.label")}
      tabs={[
        { id: "orders", label: t("tabs.orders"), render: () => <OrdersTab /> },
        { id: "shipments", label: t("tabs.shipments"), render: () => <ShipmentsTab /> },
        // "...(cond ? [x] : [])" => pestañas condicionales sin "undefined" en el arreglo
        ...(isAdmin
          ? [
              { id: "invoices", label: t("tabs.invoices"), render: () => <InvoicesTab /> },
              { id: "refunds", label: t("tabs.refunds"), render: () => <RefundsTab /> },
              { id: "transfers", label: t("tabs.transfers"), render: () => <TransfersTab /> }, // RF-08.3
              { id: "dian", label: t("tabs.dian"), render: () => <DianTab /> }, // RF-11.3 resoluciones y reporte tributario
            ]
          : []),
      ]}
    />
  );
}

// ---------- Pedidos ----------
function OrdersTab() {
  const t = useTranslations("admin.orders");
  const tOrder = useTranslations("order"); // Reutiliza las traducciones de estado de la tienda (DRY)
  const format = useFormat();
  const statusOptions = toOptions(ORDER_STATUSES, (value) => tOrder(`status.${value}`));
  const { hasRole } = useAuth();
  return (
    <AdminResource<OrderSummary, typeof orderStatusSchema, typeof orderStatusSchema>
      resource="orders"
      path="/order"
      title={t("tabs.orders")}
      invalidate={["kpi"]} // Cambiar estados mueve los contadores operativos de la portada
      rowLabel={(row) => row.orderNumber}
      toolbar={hasRole("ADMIN") ? <NewOrderButton /> : undefined} // "Nuevo pedido" (POST /order/manual, solo ADMIN en Express)
      filters={[{ name: "status", label: t("status"), options: statusOptions }]}
      columns={[
        { key: "number", header: t("number"), cell: (row) => <span className="font-medium">{row.orderNumber}</span> },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={tOrder(`status.${row.status}`)} /> },
        { key: "items", header: t("items"), cell: (row) => row.itemCount, className: "text-right" },
        { key: "total", header: t("total"), cell: (row) => format.money(row.totalCents, row.currency), className: "text-right" },
        { key: "date", header: t("date"), cell: (row) => format.dateTime(row.placedAt) },
        { key: "channel", header: t("channel"), cell: (row) => tOrder(`detail.channels.${row.channel}`) }, // RF-09.7 origen
      ]}
      edit={{
        schema: orderStatusSchema,
        path: (row) => `/order/${row.id}/status`, // El backend valida la transición (máquina de estados)
        toValues: (row) => ({ status: row.status, note: "" }),
        fields: [
          { name: "status", label: t("status"), type: "select", options: statusOptions },
          { name: "note", label: t("note"), type: "textarea" },
        ],
      }}
    />
  );
}

// ---------- RF-08.3 Transferencias bancarias por confirmar (el pedido se coloca al confirmar) ----------
interface PendingTransfer {
  id: string;
  checkoutSessionId: string;
  amountCents: number;
  currency: string;
  details: { reference?: string; payBefore?: string } | null;
  createdAt: string;
}
function TransfersTab() {
  const t = useTranslations("admin.orders");
  const format = useFormat();
  return (
    <AdminResource<PendingTransfer, typeof orderStatusSchema, typeof orderStatusSchema>
      resource="transfers"
      path="/payment"
      title={t("tabs.transfers")}
      query={{ provider: "BANK_TRANSFER", status: "PENDING" }}
      invalidate={["orders", "kpi"]}
      detail={false}
      rowLabel={(row) => row.details?.reference ?? row.id}
      columns={[
        { key: "reference", header: t("reference"), cell: (row) => <span className="font-medium">{row.details?.reference ?? "—"}</span> },
        { key: "total", header: t("total"), cell: (row) => format.money(row.amountCents, row.currency), className: "text-right" },
        { key: "date", header: t("date"), cell: (row) => format.dateTime(row.createdAt) },
        { key: "payBefore", header: t("payBefore"), cell: (row) => (row.details?.payBefore ? format.dateTime(row.details.payBefore) : "—") },
      ]}
      actions={(row, run) => (
        <IconAction icon="check" label={`${t("confirmTransfer")} ${row.details?.reference ?? ""}`} onClick={() => void run({ path: `/payment/${row.id}/confirm`, method: "PATCH" }, t("transferConfirmed"))} />
      )}
    />
  );
}

// ---------- Envíos ----------
function ShipmentsTab() {
  const t = useTranslations("admin.orders");
  const tOrder = useTranslations("order");
  const format = useFormat();
  const { accessToken } = useAuth();
  const statusOptions = toOptions(SHIPMENT_STATUSES, (value) => tOrder(`tracking.status.${value}`));
  return (
    <AdminResource<Shipment, typeof shipmentUpdateSchema, typeof shipmentUpdateSchema>
      resource="shipments"
      path="/shipping"
      title={t("tabs.shipments")}
      invalidate={["orders"]}
      rowLabel={(row) => row.orderNumber}
      filters={[{ name: "status", label: t("status"), options: statusOptions }]}
      columns={[
        { key: "order", header: t("number"), cell: (row) => row.orderNumber },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={tOrder(`tracking.status.${row.status}`)} /> },
        { key: "carrier", header: t("carrier"), cell: (row) => row.carrier ?? "—" },
        { key: "tracking", header: t("tracking"), cell: (row) => row.trackingNumber ?? "—" },
        { key: "eta", header: t("eta"), cell: (row) => (row.estimatedDelivery ? format.date(row.estimatedDelivery) : "—") },
      ]}
      // Acciones propias: generar guía (si aún no hay) o descargarla
      actions={(row, run) => (
        <>
          <IconAction icon="truck" disabled={Boolean(row.trackingNumber)} label={`${t("createLabel")} ${row.orderNumber}`} onClick={() => void run({ path: "/shipping/label", method: "POST", body: { shipmentId: row.id } }, t("labelCreated"))} />
          {/* Anular guía: solo con guía generada y paquete sin despachar (LABEL_CREATED) => vuelve a "pendiente" */}
          <IconAction icon="delete" disabled={row.status !== "LABEL_CREATED"} label={`${t("voidLabel")} ${row.orderNumber}`} onClick={() => window.confirm(t("confirmVoidLabel")) && void run({ path: `/shipping/${row.id}/label`, method: "DELETE" }, t("labelVoided"))} />
          <IconAction icon="download" disabled={!row.trackingNumber} label={`${t("label")} ${row.orderNumber}`} onClick={() => accessToken && downloadAuthed(`/shipping/${row.id}/label`, `guia-${row.orderNumber}.pdf`, accessToken).catch(() => toast.error(t("downloadError")))} />
        </>
      )}
      edit={{
        schema: shipmentUpdateSchema,
        toValues: (row) => ({ status: row.status as (typeof SHIPMENT_STATUSES)[number], description: "", location: "" }),
        fields: [
          { name: "status", label: t("status"), type: "select", options: statusOptions },
          { name: "description", label: t("eventDescription"), type: "textarea" },
          { name: "location", label: t("location") },
        ],
      }}
    />
  );
}

// ---------- Facturas ----------
function InvoicesTab() {
  const t = useTranslations("admin.orders");
  const format = useFormat();
  const { accessToken } = useAuth();
  return (
    <AdminResource<Invoice, typeof invoiceSchema, typeof creditNoteSchema>
      resource="invoices"
      path="/invoice"
      title={t("tabs.invoices")}
      rowLabel={(row) => row.number}
      columns={[
        { key: "number", header: t("invoiceNumber"), cell: (row) => <span className="font-medium">{row.number}</span> },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={t(`invoiceStatus.${row.status}`)} /> },
        { key: "total", header: t("total"), cell: (row) => format.money(row.totalCents, row.currency), className: "text-right" },
        { key: "issued", header: t("date"), cell: (row) => (row.issuedAt ? format.date(row.issuedAt) : "—") },
      ]}
      actions={(row, run) => (
        <>
          <IconAction icon="download" label={`PDF ${row.number}`} onClick={() => accessToken && downloadAuthed(`/invoice/${row.id}/pdf`, `${row.number}.pdf`, accessToken).catch(() => toast.error(t("downloadError")))} />
          {/* RF-11.2 reenviar al correo del comprador; RF-11.3 anular con nota crédito total */}
          <IconAction icon="send" label={`${t("resendInvoice")} ${row.number}`} onClick={() => void run({ path: `/invoice/${row.id}/email`, method: "POST" }, t("invoiceSent"))} />
          {(
            <FormAction icon="delete" disabled={row.status === "VOIDED"} label={`${t("voidInvoice")} ${row.number}`} title={t("voidInvoice")} resources={["invoices"]} success={t("invoiceVoided")} schema={voidInvoiceSchema} initialValues={{ reason: "" }} fields={[{ name: "reason", label: t("reason"), type: "textarea" }]} toRequest={(values) => ({ path: `/invoice/${row.id}/void`, method: "POST", body: values })} />
          )}
        </>
      )}
      // Crear = emitir la factura de un pedido; "editar" = emitir nota crédito sobre la factura (POST, no PATCH)
      create={{ schema: invoiceSchema, initialValues: { orderId: "" }, fields: [{ name: "orderId", label: t("orderId"), hint: t("orderIdHint") }] }}
      edit={{
        schema: creditNoteSchema,
        path: (row) => `/invoice/${row.id}/credit-note`,
        toValues: () => ({ amount: 0, reason: "" }),
        toBody: (values) => ({ amountCents: values.amount, reason: values.reason }),
        fields: [
          { name: "amount", label: t("creditAmount"), type: "number", hint: t("creditHint") },
          { name: "reason", label: t("reason"), type: "textarea" },
        ],
      }}
    />
  );
}

// ---------- RF-11.3 DIAN: resoluciones de facturación + reporte tributario ----------
function DianTab() {
  const t = useTranslations("admin.orders");
  const format = useFormat();
  const { accessToken } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  return (
    <div className="flex flex-col gap-6">
      <AdminResource<DianResolution, typeof resolutionSchema, typeof resolutionSchema>
        resource="dian-resolutions"
        path="/invoice/resolution"
        title={t("dianResolutions")}
        rowLabel={(row) => row.resolutionNumber}
        columns={[
          { key: "number", header: t("resolutionNumber"), cell: (row) => <span className="font-medium">{row.resolutionNumber}</span> },
          { key: "range", header: t("range"), cell: (row) => `${row.prefix}${row.fromNumber} – ${row.prefix}${row.toNumber}` },
          { key: "next", header: t("nextNumber"), cell: (row) => `${row.prefix}${row.nextNumber}`, className: "tabular-nums" },
          { key: "valid", header: t("validTo"), cell: (row) => format.date(row.validTo) },
          // Alertas (texto + color): rango casi agotado o resolución por vencer
          { key: "alerts", header: t("alerts"), cell: (row) => (row.alerts.length ? row.alerts.map((alert) => <StatusBadge key={alert} status="PENDING" label={t(`resolutionAlerts.${alert}`)} />) : row.isActive ? t("active") : t("inactive")) },
        ]}
        actions={(row, run) => <IconAction icon={row.isActive ? "archive" : "check"} label={`${row.isActive ? t("deactivate") : t("activate")} ${row.resolutionNumber}`} onClick={() => void run({ path: `/invoice/resolution/${row.id}`, method: "PATCH", body: { isActive: !row.isActive } }, t("saved"))} />}
        create={{
          schema: resolutionSchema,
          initialValues: { resolutionNumber: "", prefix: "", fromNumber: 1, toNumber: 5000, technicalKey: "", validFrom: today, validTo: "" },
          fields: [
            { name: "resolutionNumber", label: t("resolutionNumber") },
            { name: "prefix", label: t("prefix") },
            { name: "fromNumber", label: t("fromNumber"), type: "number" },
            { name: "toNumber", label: t("toNumber"), type: "number" },
            { name: "technicalKey", label: t("technicalKey") },
            { name: "validFrom", label: t("validFrom"), type: "date" },
            { name: "validTo", label: t("validTo"), type: "date" },
          ],
        }}
      />
      <TaxReport from={monthStart} to={today} token={accessToken} />
    </div>
  );
}

// TaxReport => RF-11.3 reporte tributario del período (tabla + descarga CSV para el contador)
function TaxReport({ from: initialFrom, to: initialTo, token }: { from: string; to: string; token: string | undefined }) {
  const t = useTranslations("admin.orders");
  const format = useFormat();
  const [range, setRange] = useState({ from: initialFrom, to: initialTo });
  const query = { from: range.from, to: `${range.to}T23:59:59` };
  const report = useAdminGet<{ rows: Array<{ month: string; invoices: number; subtotalCents: number; taxCents: number; totalCents: number; creditNotesCents: number }>; totals: Record<string, number> }>("tax-report", "/invoice/report", query);
  return (
    <section aria-labelledby="tax-report-title" className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 id="tax-report-title" className="font-semibold">{t("taxReport")}</h3>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">{t("from")}<input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className="h-9 rounded-md border border-slate-300 px-3 text-sm" /></label>
        <label className="flex flex-col gap-1">{t("to")}<input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className="h-9 rounded-md border border-slate-300 px-3 text-sm" /></label>
        <button type="button" className="h-9 rounded-md border px-3 hover:bg-accent" onClick={() => token && downloadAuthed(`/invoice/report?from=${range.from}&to=${range.to}T23:59:59&format=csv`, `reporte-tributario-${range.from}.csv`, token).catch(() => toast.error(t("downloadError")))}>{t("downloadCsv")}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{t("taxReport")}</caption>
          <thead className="border-b text-left text-slate-600"><tr>{["month", "invoices", "taxBase", "iva", "total", "creditNotes"].map((key) => <th key={key} scope="col" className="py-2 pr-3">{t(`taxCols.${key}`)}</th>)}</tr></thead>
          <tbody>
            {(report.data?.rows ?? []).map((row) => (
              <tr key={row.month} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">{row.month}</th>
                <td className="py-2 pr-3 tabular-nums">{row.invoices}</td>
                <td className="py-2 pr-3 tabular-nums">{format.money(row.subtotalCents)}</td>
                <td className="py-2 pr-3 tabular-nums">{format.money(row.taxCents)}</td>
                <td className="py-2 pr-3 tabular-nums">{format.money(row.totalCents)}</td>
                <td className="py-2 tabular-nums">{format.money(row.creditNotesCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.data && <p className="text-sm font-medium">{t("netTotal", { value: format.money(report.data.totals["netCents"] ?? 0) })}</p>}
    </section>
  );
}

// RefundStats => RF-12.9 estadísticas de devoluciones (tasa, razones más frecuentes, tiempo de resolución)
function RefundStats() {
  const t = useTranslations("admin.orders");
  const tOrder = useTranslations("order");
  const format = useFormat();
  const stats = useAdminGet<{ total: number; byReason: Array<{ reason: string; count: number }>; refundedCents: number; returnRate: number; avgResolutionHours: number | null }>("refund-stats", "/refund/stats", { days: 90 });
  if (!stats.data) return null;
  const top = stats.data.byReason.slice(0, 3);
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4" aria-label={t("refundStats")}>
      <div className="rounded-md border p-2"><dt className="text-slate-500">{t("returnRate")}</dt><dd className="text-base font-semibold">{(stats.data.returnRate * 100).toFixed(1)} %</dd></div>
      <div className="rounded-md border p-2"><dt className="text-slate-500">{t("refunded")}</dt><dd className="text-base font-semibold">{format.money(stats.data.refundedCents)}</dd></div>
      <div className="rounded-md border p-2"><dt className="text-slate-500">{t("avgResolution")}</dt><dd className="text-base font-semibold">{stats.data.avgResolutionHours ?? "—"} h</dd></div>
      <div className="rounded-md border p-2"><dt className="text-slate-500">{t("topReasons")}</dt><dd>{top.map((row) => `${tOrder(`refundReasons.${row.reason}`)} (${row.count})`).join(", ") || "—"}</dd></div>
    </dl>
  );
}

// ---------- Devoluciones ----------
function RefundsTab() {
  const t = useTranslations("admin.orders");
  const tOrder = useTranslations("order");
  const format = useFormat();
  const { accessToken } = useAuth();
  return (
    <AdminResource<Refund, typeof refundReviewSchema, typeof refundReviewSchema>
      resource="refunds"
      path="/refund"
      title={t("tabs.refunds")}
      invalidate={["kpi"]}
      rowLabel={(row) => row.orderNumber}
      filters={[{ name: "status", label: t("status"), options: toOptions(REFUND_STATUSES, (value) => t(`refundStatus.${value}`)) }]}
      toolbar={<RefundStats />}
      actions={(row) => (
        <>
          {/* RF-12.2 seguimiento de la recolección y etiqueta; RF-12.7 inspección al recibir */}
          {<IconAction icon="download" disabled={!row.returnTrackingNumber} label={`${t("returnLabel")} ${row.orderNumber}`} onClick={() => accessToken && downloadAuthed(`/refund/${row.id}/label`, `devolucion-${row.orderNumber}.pdf`, accessToken).catch(() => toast.error(t("downloadError")))} />}
          {(
            <FormAction icon="truck" disabled={row.returnStatus !== "PICKUP_SCHEDULED" && row.returnStatus !== "IN_TRANSIT"} label={`${t("returnStatus")} ${row.orderNumber}`} title={t("returnStatus")} resources={["refunds"]} success={t("saved")} schema={returnStatusSchema} initialValues={{ status: "RECEIVED" }} fields={[{ name: "status", label: t("status"), type: "select", options: toOptions(["IN_TRANSIT", "RECEIVED"], (value) => t(`returnStatuses.${value}`)) }]} toRequest={(values) => ({ path: `/refund/${row.id}/return`, method: "PATCH", body: values })} />
          )}
          {(
            <FormAction icon="check" disabled={row.returnStatus !== "RECEIVED"} label={`${t("inspect")} ${row.orderNumber}`} title={t("inspect")} resources={["refunds"]} success={t("saved")} schema={inspectionSchema} initialValues={{ passed: "true", notes: "", photoUrls: "" }}
              fields={[{ name: "passed", label: t("decision"), type: "select", options: [{ value: "true", label: t("inspectionOk") }, { value: "false", label: t("inspectionFailed") }] }, { name: "notes", label: t("note"), type: "textarea" }, { name: "photoUrls", label: t("photoUrls"), type: "textarea", hint: t("photoUrlsHint") }]}
              toRequest={(values) => ({ path: `/refund/${row.id}/inspection`, method: "POST", body: { ...values, photoUrls: String(values.photoUrls).split(/[\s,]+/).filter(Boolean) } })} />
          )}
        </>
      )}
      columns={[
        { key: "order", header: t("number"), cell: (row) => row.orderNumber },
        { key: "reason", header: t("reason"), cell: (row) => <span title={row.description}>{tOrder(`refundReasons.${row.reason}`)}</span> },
        { key: "resolution", header: t("resolution"), cell: (row) => t(`resolutions.${row.resolution}`) },
        { key: "return", header: t("returnStatus"), cell: (row) => (row.returnStatus ? t(`returnStatuses.${row.returnStatus}`) : "—") },
        { key: "amount", header: t("total"), cell: (row) => format.money(row.amountCents, row.currency), className: "text-right" },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={t(`refundStatus.${row.status}`)} /> },
        { key: "date", header: t("date"), cell: (row) => format.date(row.createdAt) },
      ]}
      edit={{
        schema: refundReviewSchema,
        path: (row) => `/refund/${row.id}/approve`,
        when: (row) => row.status === "REQUESTED", // Solo las solicitudes pendientes se pueden decidir
        toValues: () => ({ approve: "true", note: "" }),
        fields: [
          { name: "approve", label: t("decision"), type: "select", options: [{ value: "true", label: t("approve") }, { value: "false", label: t("reject") }] },
          { name: "note", label: t("note"), type: "textarea" },
        ],
      }}
    />
  );
}
