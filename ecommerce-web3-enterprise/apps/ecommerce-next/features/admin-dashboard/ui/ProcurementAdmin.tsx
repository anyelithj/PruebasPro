// ProcurementAdmin.tsx (Client Component · React + TanStack Query + BarcodeDetector nativo + Tailwind) => compras e
// inventario avanzado:
//  - PurchaseOrdersTab: RF-23.6 órdenes de compra (crear, enviar por correo/WhatsApp RF-23.9, recibir con control de
//    calidad, anular) y RF-23.8 cuentas por pagar con estado de vencimiento y registro del pago
//  - SuppliersRankingTab: RF-23.5 ranking + RF-23.8 comparación de precios entre proveedores
//  - ValuationTab: RF-23.3 valor del inventario (costo promedio o FIFO)
//  - AuditTab: RF-23.7 etiquetas QR y conteo por escaneo con la cámara (o lector / teclado)
// Patrones: Composite + Command + Strategy (método de valoración). Accesibilidad: aria-live en el conteo, video con
// etiqueta, alternativa por teclado al escáner.
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useAdminGet, useAdminList, useAdminMutation, type Supplier } from "../api/dashboard.api";
import { AdminResource, DialogButton, FormAction, IconAction, toOptions, useAdminCommand } from "./AdminResource";
import { DataTable } from "./DataTable";
import { KPICard } from "./KPICard";
import { SectionHeader } from "./AdminFields";
import { StatusBadge } from "./OrdersAdmin";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";
import { toast } from "@/shared/ui/Toast";

interface PurchaseOrder {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  totalCents: number;
  currency: string;
  expectedAt: string | null;
  sentVia: string[];
  dueAt: string | null;
  paidAt: string | null;
  payable: "PAID" | "OVERDUE" | "DUE_SOON" | "OPEN";
  createdAt: string;
  supplier: { id: string; name: string };
  items: Array<{ id: string; quantity: number; unitCostCents: number; receivedQuantity: number; rejectedQuantity: number; variant: { sku: string; name: string; product: { name: string } } }>;
}
const PO_STATUSES = ["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"] as const;
const PAYABLE_TONE = { PAID: "APPROVED", OVERDUE: "FAILED", DUE_SOON: "PENDING", OPEN: "DRAFT" } as const;

// "SKU, cantidad, costo" por línea -> líneas de la orden (costo en pesos -> centavos)
const linesSchema = z.string().trim().min(3, "validation.required").transform((value, ctx) => {
  const items = value.split("\n").map((line) => line.split(",").map((part) => part.trim())).filter((parts) => parts[0]);
  const parsed = items.map(([sku, quantity, cost]) => ({ sku: sku!, quantity: Number(quantity), unitCostCents: Math.round(Number(cost) * 100) }));
  if (parsed.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitCostCents) || item.unitCostCents < 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "validation.poLines" });
    return z.NEVER;
  }
  return parsed;
});
const poSchema = z.object({ supplierId: z.string().min(1, "validation.required"), lines: linesSchema, expectedAt: z.string().optional(), notes: z.string().trim().max(1000).optional(), send: z.boolean() });

export function PurchaseOrdersTab() {
  const t = useTranslations("admin.procurement");
  const format = useFormat();
  const suppliers = useAdminList<Supplier>("suppliers", "/supplier", { page: 1, limit: 100 });
  const supplierOptions = (suppliers.data?.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }));
  return (
    <AdminResource<PurchaseOrder, typeof poSchema>
      resource="purchase-orders"
      path="/supplier/purchase-order"
      title={t("orders")}
      rowLabel={(row) => row.number}
      filters={[
        { name: "status", label: t("status"), options: toOptions(PO_STATUSES, (v) => t(`statuses.${v}`)) },
        { name: "payable", label: t("payable"), options: toOptions(["open", "due", "overdue", "paid"], (v) => t(`payables.${v}`)) },
      ]}
      columns={[
        { key: "number", header: t("number"), cell: (row) => <span className="font-medium">{row.number}</span> },
        { key: "supplier", header: t("supplier"), cell: (row) => row.supplier.name },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status} label={t(`statuses.${row.status}`)} /> },
        { key: "total", header: t("total"), cell: (row) => format.money(row.totalCents, row.currency), className: "text-right" },
        { key: "expected", header: t("expectedAt"), cell: (row) => (row.expectedAt ? format.date(row.expectedAt) : "—") },
        { key: "payable", header: t("payable"), cell: (row) => (row.dueAt ? <StatusBadge status={PAYABLE_TONE[row.payable]} label={`${t(`payableStates.${row.payable}`)} · ${format.date(row.dueAt)}`} /> : "—") },
        { key: "sent", header: t("sentVia"), cell: (row) => row.sentVia.join(", ") || "—" },
      ]}
      actions={(row, run) => (
        <>
          {(
            <IconAction icon="send" disabled={row.status !== "DRAFT" && row.status !== "SENT"} label={`${t("send")} ${row.number}`} onClick={() => void run({ path: `/supplier/purchase-order/${row.id}/send`, method: "POST", body: { channels: ["EMAIL", "WHATSAPP"] } }, t("sent"))} />
          )}
          {(
            <DialogButton icon="box" disabled={row.status !== "SENT" && row.status !== "PARTIAL"} label={`${t("receive")} ${row.number}`} title={`${t("receive")} · ${row.number}`}>
              {(close) => <ReceiveForm order={row} onDone={close} />}
            </DialogButton>
          )}
          {<IconAction icon="check" disabled={!row.dueAt || Boolean(row.paidAt)} label={`${t("pay")} ${row.number}`} onClick={() => window.confirm(t("confirmPay", { number: row.number })) && void run({ path: `/supplier/purchase-order/${row.id}/pay`, method: "POST" }, t("paid"))} />}
          {<IconAction icon="delete" disabled={row.status !== "DRAFT" && row.status !== "SENT"} label={`${t("cancel")} ${row.number}`} onClick={() => window.confirm(t("confirmCancel")) && void run({ path: `/supplier/purchase-order/${row.id}/cancel`, method: "POST" }, t("cancelled"))} />}
        </>
      )}
      create={{
        schema: poSchema,
        initialValues: { supplierId: "", lines: "", expectedAt: "", notes: "", send: false },
        fields: [
          { name: "supplierId", label: t("supplier"), type: "select", options: [{ value: "", label: "—" }, ...supplierOptions] },
          { name: "lines", label: t("lines"), type: "textarea", hint: t("linesHint") },
          { name: "expectedAt", label: t("expectedAt"), type: "date", hint: t("expectedHint") },
          { name: "notes", label: t("notes"), type: "textarea" },
          { name: "send", label: t("sendNow"), type: "checkbox" },
        ],
        toBody: (v) => ({ supplierId: v.supplierId, items: v.lines, ...(v.expectedAt ? { expectedAt: new Date(v.expectedAt).toISOString() } : {}), ...(v.notes ? { notes: v.notes } : {}), send: v.send }),
      }}
    />
  );
}

// ReceiveForm => QC por línea: aceptadas (entran al inventario) y rechazadas (no entran)
function ReceiveForm({ order, onDone }: { order: PurchaseOrder; onDone: () => void }) {
  const t = useTranslations("admin.procurement");
  const pending = order.items.map((item) => ({ ...item, open: item.quantity - item.receivedQuantity - item.rejectedQuantity })).filter((item) => item.open > 0);
  const [lines, setLines] = useState(() => Object.fromEntries(pending.map((item) => [item.id, { accepted: item.open, rejected: 0, qcNotes: "" }])));
  const { run, isPending } = useAdminCommand(["purchase-orders", "inventory", "valuation"]);
  const submit = async () => {
    const items = Object.entries(lines).filter(([, l]) => l.accepted + l.rejected > 0).map(([itemId, l]) => ({ itemId, accepted: l.accepted, rejected: l.rejected, ...(l.qcNotes ? { qcNotes: l.qcNotes } : {}) }));
    if (items.length && (await run({ path: `/supplier/purchase-order/${order.id}/receive`, method: "POST", body: { items } }, t("received")))) onDone();
  };
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("receive")}</caption>
        <thead className="text-left text-slate-600"><tr><th scope="col">SKU</th><th scope="col">{t("pending")}</th><th scope="col">{t("accepted")}</th><th scope="col">{t("rejected")}</th><th scope="col">{t("qcNotes")}</th></tr></thead>
        <tbody>
          {pending.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="py-1">{item.variant.sku}</td>
              <td className="tabular-nums">{item.open}</td>
              {(["accepted", "rejected"] as const).map((key) => (
                <td key={key}><input aria-label={`${t(key)} ${item.variant.sku}`} type="number" min={0} max={item.open} value={lines[item.id]?.[key] ?? 0} onChange={(e) => setLines((c) => ({ ...c, [item.id]: { ...c[item.id]!, [key]: Number(e.target.value) } }))} className="h-9 w-20 rounded-md border border-slate-300 px-3 text-sm" /></td>
              ))}
              <td><input aria-label={`${t("qcNotes")} ${item.variant.sku}`} value={lines[item.id]?.qcNotes ?? ""} onChange={(e) => setLines((c) => ({ ...c, [item.id]: { ...c[item.id]!, qcNotes: e.target.value } }))} className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button onClick={() => void submit()} loading={isPending} className="self-start">{t("confirmReceive")}</Button>
    </div>
  );
}

export function SuppliersRankingTab() {
  const t = useTranslations("admin.procurement");
  const format = useFormat();
  const ranking = useAdminGet<Array<{ position: number; supplierId: string; name: string; score: number; orders: number; onTimeRate: number | null; qualityRate: number | null; rating: number | null; priceIndex: number | null; totalCents: number }>>("supplier-ranking", "/supplier/ranking");
  const [q, setQ] = useState("");
  const prices = useAdminGet<Array<{ variantId: string; sku: string; productName: string; supplierName: string; lastCostCents: number; avgCostCents: number; lastOrderAt: string }>>("price-comparison", q.length >= 2 ? "/supplier/price-comparison" : null, { q });
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeader title={t("ranking")} description={t("rankingHint")} />
        <DataTable
          caption={t("ranking")}
          rows={ranking.data}
          loading={ranking.isLoading}
          rowKey={(row) => row.supplierId}
          columns={[
            { key: "pos", header: "#", cell: (row) => row.position, className: "tabular-nums" },
            { key: "name", header: t("supplier"), cell: (row) => <span className="font-medium">{row.name}</span> },
            { key: "score", header: t("score"), cell: (row) => `${row.score}/100`, className: "text-right tabular-nums" },
            { key: "onTime", header: t("onTime"), cell: (row) => pct(row.onTimeRate), className: "text-right" },
            { key: "quality", header: t("quality"), cell: (row) => pct(row.qualityRate), className: "text-right" },
            { key: "price", header: t("priceIndex"), cell: (row) => (row.priceIndex === null ? "—" : row.priceIndex.toFixed(2)), className: "text-right" },
            { key: "total", header: t("purchased"), cell: (row) => format.money(row.totalCents), className: "text-right" },
          ]}
        />
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeader title={t("priceComparison")} description={t("priceComparisonHint")} actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchSku")} aria-label={t("searchSku")} className="h-9 rounded-md border border-slate-300 px-3 text-sm" />} />
        {q.length >= 2 && (
          <DataTable
            caption={t("priceComparison")}
            rows={prices.data}
            loading={prices.isLoading}
            rowKey={(row) => `${row.variantId}-${row.supplierName}`}
            columns={[
              { key: "sku", header: "SKU", cell: (row) => `${row.sku} · ${row.productName}` },
              { key: "supplier", header: t("supplier"), cell: (row) => row.supplierName },
              { key: "last", header: t("lastCost"), cell: (row) => format.money(row.lastCostCents), className: "text-right" },
              { key: "avg", header: t("avgCost"), cell: (row) => format.money(row.avgCostCents), className: "text-right" },
              { key: "date", header: t("lastOrder"), cell: (row) => format.date(row.lastOrderAt) },
            ]}
          />
        )}
      </section>
    </div>
  );
}

export function ValuationTab() {
  const t = useTranslations("admin.procurement");
  const format = useFormat();
  const [method, setMethod] = useState<"AVERAGE" | "FIFO">("AVERAGE");
  const { data, isLoading } = useAdminGet<{ totalCents: number; unvaluedUnits: number; items: Array<{ variantId: string; sku: string; name: string; stock: number; valueCents: number; unitCostCents: number; unvaluedUnits: number }> }>("valuation", "/supplier/valuation", { method });
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={t("valuation")}
        description={t("valuationHint")}
        actions={
          <label className="flex items-center gap-2 text-sm">{t("method")}
            <select value={method} onChange={(e) => setMethod(e.target.value as "AVERAGE" | "FIFO")} className="h-9 rounded-md border border-slate-300 px-3 text-sm">
              <option value="AVERAGE">{t("methods.AVERAGE")}</option>
              <option value="FIFO">FIFO</option>
            </select>
          </label>
        }
      />
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <KPICard label={t("inventoryValue")} value={format.money(data.totalCents)} />
          <KPICard label={t("unvalued")} value={String(data.unvaluedUnits)} />
        </div>
      )}
      <DataTable
        caption={t("valuation")}
        rows={data?.items}
        loading={isLoading}
        rowKey={(row) => row.variantId}
        columns={[
          { key: "sku", header: "SKU", cell: (row) => `${row.sku} · ${row.name}` },
          { key: "stock", header: t("stock"), cell: (row) => row.stock, className: "text-right tabular-nums" },
          { key: "unit", header: t("unitCost"), cell: (row) => format.money(row.unitCostCents), className: "text-right" },
          { key: "value", header: t("value"), cell: (row) => format.money(row.valueCents), className: "text-right" },
          { key: "unvalued", header: t("unvalued"), cell: (row) => row.unvaluedUnits || "—", className: "text-right" },
        ]}
      />
    </section>
  );
}

// ---------- RF-23.7 auditoría por QR ----------
interface Audit {
  id: string;
  status: "OPEN" | "CLOSED";
  warehouse: string;
  note: string | null;
  applied: boolean;
  createdAt: string;
  counts: Array<{ variantId: string; sku: string; counted: number }>;
}
const auditSchema = z.object({ warehouse: z.enum(["MAIN", "STORE", "CONSIGNMENT"]), note: z.string().trim().max(300).optional() });

export function AuditTab() {
  const t = useTranslations("admin.procurement");
  const tc = useTranslations("admin.common");
  const format = useFormat();
  const audits = useAdminGet<Audit[]>("inventory-audits", "/inventory/audit");
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={t("audit")}
        description={t("auditHint")}
        actions={
          <div className="flex flex-wrap gap-2">
            <QrLabelsButton />
            <FormAction label={tc("new")} title={t("startAudit")} variant="primary" resources={["inventory-audits"]} schema={auditSchema} initialValues={{ warehouse: "MAIN", note: "" }} fields={[{ name: "warehouse", label: t("warehouse"), type: "select", options: toOptions(["MAIN", "STORE", "CONSIGNMENT"], (v) => t(`warehouses.${v}`)) }, { name: "note", label: t("notes") }]} toRequest={(v) => ({ path: "/inventory/audit", method: "POST", body: v })} />
          </div>
        }
      />
      {audits.isLoading ? <Skeleton className="h-24 w-full" /> : (
        <ul className="flex flex-col gap-2">
          {(audits.data ?? []).map((audit) => (
            <li key={audit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <span>{format.dateTime(audit.createdAt)} · {t(`warehouses.${audit.warehouse}`)} · {t("scanned", { n: audit.counts.length })} · <StatusBadge status={audit.status === "OPEN" ? "PENDING" : "APPROVED"} label={t(`auditStatuses.${audit.status}`)} /></span>
              {audit.status === "OPEN" && <Button size="sm" variant={active === audit.id ? "primary" : "secondary"} onClick={() => setActive(active === audit.id ? null : audit.id)}>{t("continue")}</Button>}
            </li>
          ))}
        </ul>
      )}
      {active && <AuditScanner auditId={active} onClosed={() => setActive(null)} />}
    </div>
  );
}

// BarcodeDetector => API nativa del navegador (Chrome/Edge/Android) para leer QR con la cámara; sin ella se usa el
// campo de texto (lectores USB escriben el código + Enter como un teclado)
type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

function AuditScanner({ auditId, onClosed }: { auditId: string; onClosed: () => void }) {
  const t = useTranslations("admin.procurement");
  const errorMessage = useErrorMessage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<string>("");
  const audit = useAdminGet<Audit>(`inventory-audit-${auditId}`, `/inventory/audit/${auditId}`);
  const scan = useAdminMutation<string, { sku: string; counted: number }>([`inventory-audit-${auditId}`, "inventory-audits"], (value) => ({ path: `/inventory/audit/${auditId}/scan`, method: "POST", body: { code: value } }));
  const close = useAdminMutation<boolean, { discrepancies: Array<{ sku: string; counted: number; system: number; difference: number }> }>(["inventory-audits", "inventory"], (apply) => ({ path: `/inventory/audit/${auditId}/close`, method: "POST", body: { apply } }));
  const lastCode = useRef("");

  const submit = (value: string) => {
    if (!value.trim()) return;
    scan.mutate(value, { onSuccess: (r) => setLast(t("scanOk", { sku: r.sku, counted: r.counted })), onError: (error) => toast.error(errorMessage(error)) });
    setCode("");
  };

  // Cámara: lee un cuadro cada 700 ms; ignora el mismo código repetido en 2 s (evita contar dos veces el mismo escaneo)
  useEffect(() => {
    if (!camera || !window.BarcodeDetector) return;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((media) => {
      stream = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        void videoRef.current.play();
      }
      timer = window.setInterval(async () => {
        if (!videoRef.current) return;
        const [found] = await detector.detect(videoRef.current).catch(() => []);
        if (found && found.rawValue !== lastCode.current) {
          lastCode.current = found.rawValue;
          submit(found.rawValue);
          window.setTimeout(() => (lastCode.current = ""), 2000);
        }
      }, 700);
    });
    return () => {
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop()); // Apaga la cámara al salir (privacidad y batería)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- "submit" usa mutate estable de TanStack Query
  }, [camera]);

  return (
    <section aria-labelledby="audit-scan" className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 id="audit-scan" className="font-semibold">{t("scanTitle")}</h3>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); submit(code); }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SKU:ABC-123" aria-label={t("code")} autoFocus className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
        <Button type="submit" loading={scan.isPending}>{t("add")}</Button>
        {typeof window !== "undefined" && window.BarcodeDetector && <Button type="button" variant="secondary" onClick={() => setCamera((c) => !c)}>{camera ? t("cameraOff") : t("cameraOn")}</Button>}
      </form>
      {camera && <video ref={videoRef} aria-label={t("cameraLabel")} muted playsInline className="aspect-video w-full max-w-md rounded-md bg-black" />}
      <p aria-live="polite" className="text-sm text-emerald-700">{last}</p>
      <DataTable caption={t("scanned", { n: audit.data?.counts.length ?? 0 })} rows={audit.data?.counts} rowKey={(row) => row.variantId} columns={[{ key: "sku", header: "SKU", cell: (row) => row.sku }, { key: "counted", header: t("counted"), cell: (row) => row.counted, className: "text-right tabular-nums" }]} />
      {close.data && (
        <ul className="text-sm">
          {close.data.discrepancies.length === 0 ? <li>{t("noDiscrepancies")}</li> : close.data.discrepancies.map((d) => <li key={d.sku}>{d.sku}: {t("discrepancy", { counted: d.counted, system: d.system, difference: d.difference })}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => close.mutate(false, { onSuccess: onClosed })}>{t("closeOnly")}</Button>
        <Button onClick={() => window.confirm(t("confirmApply")) && close.mutate(true, { onSuccess: () => { toast.success(t("applied")); onClosed(); } })}>{t("closeApply")}</Button>
      </div>
    </section>
  );
}

// QrLabelsButton => etiquetas QR de las variantes con stock bajo o buscadas, listas para imprimir (window.print)
function QrLabelsButton() {
  const t = useTranslations("admin.procurement");
  return (
    <DialogButton label={t("qrLabels")} title={t("qrLabels")}>
      {() => <QrLabels />}
    </DialogButton>
  );
}

function QrLabels() {
  const t = useTranslations("admin.procurement");
  const errorMessage = useErrorMessage();
  const [q, setQ] = useState("");
  const levels = useAdminGet<Array<{ variantId: string; sku: string }>>("qr-search", "/inventory", { q, limit: 24 });
  const labels = useAdminMutation<string[], Array<{ variantId: string; sku: string; name: string; svg: string }>>([], (variantIds) => ({ path: "/inventory/qr", method: "POST", body: { variantIds } }));
  const ids = (levels.data ?? []).map((level) => level.variantId);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 print:hidden">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchSku")} aria-label={t("searchSku")} className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
        <Button onClick={() => ids.length && labels.mutate(ids, { onError: (e) => toast.error(errorMessage(e)) })} loading={labels.isPending}>{t("generate", { n: ids.length })}</Button>
        {labels.data && <Button variant="secondary" onClick={() => window.print()}>{t("print")}</Button>}
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {(labels.data ?? []).map((label) => (
          <li key={label.variantId} className="flex flex-col items-center gap-1 rounded border p-2 text-center text-xs">
            {/* SVG generado por el servidor (uqr) a partir del SKU: contenido propio, no del usuario */}
            <span className="block w-full" dangerouslySetInnerHTML={{ __html: label.svg }} />
            <span className="font-mono font-semibold">{label.sku}</span>
            <span className="line-clamp-1">{label.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
