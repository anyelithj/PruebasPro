// OrderDetail.tsx => detalle completo del pedido: ítems, totales, dirección, seguimiento, factura y acciones
// (cancelar antes del envío / solicitar devolución si fue entregado).
"use client";

import { useState } from "react";
import { downloadInvoice, downloadRefundLabel, useCancelOrder, useMintProofNft, useOrder, useProductVariants, useProofNft, useReorder, useRequestRefund, useResendInvoice, useUpdateDelivery } from "../api/order.api";
import { useUploadMedia } from "@/features/media/api/media.api";
import type { OrderDetail as OrderDetailData } from "@/entities/order/model/order.types";
import { cancelSchema, refundSchema, REFUND_REASONS, REFUND_RESOLUTIONS, type CancelFormValues, type RefundFormValues } from "../lib/order.validator";
import { OrderStatus } from "./OrderStatus";
import { OrderTracking } from "./OrderTracking";
import { ProductImage } from "@/entities/product/ui/ProductImage";
import { useAuth } from "@/shared/hook/useAuth";
import { useTranslations } from "next-intl";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { useZodForm } from "@/shared/hook/useZodForm";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { Skeleton } from "@/shared/ui/Skeleton";
import { toast } from "@/shared/ui/Toast";

const DELIVERY_EDITABLE = ["CONFIRMED", "PREPARING", "PACKED", "SHIPPED"]; // RF-09.3 hasta que salga a reparto
const DAY_MS = 86_400_000;
const toDateInput = (time: number) => new Date(time).toISOString().slice(0, 10); // "YYYY-MM-DD" para <input type="date">

// DeliveryPreferences => RF-09.3 reprogramar la entrega (desde mañana, hasta 30 días) e instrucciones al mensajero
function DeliveryPreferences({ order }: { order: OrderDetailData }) {
  const t = useTranslations("order.delivery");
  const errorMessage = useErrorMessage();
  const update = useUpdateDelivery(order.id);
  const [date, setDate] = useState(order.preferredDeliveryDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(order.deliveryInstructions ?? "");
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 text-sm print:hidden"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate({ preferredDeliveryDate: date || null, deliveryInstructions: notes.trim() || null }, { onSuccess: () => toast.success(t("saved")), onError: (error) => toast.error(errorMessage(error)) });
      }}
    >
      <h2 className="font-semibold">{t("title")}</h2>
      {/* Input nativo de fecha: selector accesible del sistema, sin librería (min/max = regla del backend) */}
      <label htmlFor="delivery-date">{t("date")}</label>
      <input id="delivery-date" type="date" min={toDateInput(Date.now() + DAY_MS)} max={toDateInput(Date.now() + 30 * DAY_MS)} value={date} onChange={(event) => setDate(event.target.value)} className="h-9 rounded-md border border-slate-300 px-2" />
      <label htmlFor="delivery-notes">{t("instructions")}</label>
      <textarea id="delivery-notes" rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("placeholder")} className="rounded-md border border-slate-300 p-2" />
      <Button type="submit" size="sm" variant="secondary" loading={update.isPending} className="self-start">{t("save")}</Button>
    </form>
  );
}

// ProofOfPurchase => RF-29.3 certificado NFT del pedido entregado: estado, token, transacción y hash verificable;
// "Emitir" crea o reintenta el minteo (requiere wallet conectada: el backend lo valida y responde un error claro)
function ProofOfPurchase({ orderId }: { orderId: string }) {
  const t = useTranslations("order.proofNft");
  const errorMessage = useErrorMessage();
  const proof = useProofNft(orderId, true);
  const mint = useMintProofNft(orderId);
  const data = proof.data;
  return (
    <section aria-labelledby="proof-nft-title" className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 text-sm print:hidden">
      <h2 id="proof-nft-title" className="font-semibold">{t("title")}</h2>
      <p className="text-slate-600">{t("help")}</p>
      {data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
          <dt className="text-slate-500">{t("status")}</dt>
          <dd>{t(`statuses.${data.status}`)}</dd>
          {data.tokenId && (<><dt className="text-slate-500">Token</dt><dd className="font-mono">#{data.tokenId}</dd></>)}
          {data.txHash && (<><dt className="text-slate-500">{t("tx")}</dt><dd className="break-all font-mono">{data.txHash}</dd></>)}
          <dt className="text-slate-500">{t("hash")}</dt>
          <dd className="break-all font-mono">{data.orderHash}</dd>
          {data.failureReason && (<><dt className="text-slate-500">{t("error")}</dt><dd className="text-red-700">{data.failureReason}</dd></>)}
        </dl>
      )}
      {data?.status !== "MINTED" && (
        <Button size="sm" variant="secondary" className="self-start" loading={mint.isPending || proof.isLoading} onClick={() => mint.mutate(undefined, { onSuccess: () => toast.success(t("minted")), onError: (error) => toast.error(errorMessage(error)) })}>
          {data ? t("retry") : t("mint")}
        </Button>
      )}
    </section>
  );
}

function CancelDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations("order.cancel");
  const tRoot = useTranslations();
  const errorMessage = useErrorMessage();
  const cancel = useCancelOrder(orderId);
  const form = useZodForm({
    schema: cancelSchema,
    initialValues: { reason: "" },
    onSubmit: (values: CancelFormValues) => cancel.mutate(values.reason, { onSuccess: () => { toast.success(t("success")); onClose(); }, onError: (error) => toast.error(errorMessage(error)) }),
  });
  const reasonError = form.error("reason");
  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <form onSubmit={form.handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="cancel-reason" className="text-sm font-medium">{t("reason")}</label>
        <textarea id="cancel-reason" rows={3} className="rounded-md border border-slate-300 p-2 text-sm" aria-invalid={reasonError ? true : undefined} {...form.getFieldProps("reason")} />
        {reasonError && <p role="alert" className="text-sm text-red-600">{tRoot(reasonError)}</p>}
        <Button type="submit" variant="danger" loading={cancel.isPending}>{t("confirm")}</Button>
      </form>
    </Modal>
  );
}

function RefundDialog({ orderId, productIds, open, onClose }: { orderId: string; productIds: string[]; open: boolean; onClose: () => void }) {
  const t = useTranslations("order.refund");
  const tRoot = useTranslations();
  const errorMessage = useErrorMessage();
  const refund = useRequestRefund(orderId);
  const upload = useUploadMedia();
  const [exchangeProduct] = useState(productIds[0] ?? null);
  const variants = useProductVariants(exchangeProduct);
  const form = useZodForm({
    schema: refundSchema,
    initialValues: { reason: "DAMAGED", description: "", evidenceUrls: [], resolution: "REFUND", exchangeVariantId: "" },
    onSubmit: (values: RefundFormValues) => refund.mutate(values, { onSuccess: () => { toast.success(t("success")); onClose(); }, onError: (error) => toast.error(errorMessage(error)) }),
  });
  const descriptionError = form.error("description");
  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <form onSubmit={form.handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="refund-reason" className="text-sm font-medium">{t("reason")}</label>
        <select id="refund-reason" className="h-9 rounded-md border border-slate-300 px-2 text-sm" {...form.getFieldProps("reason")}>
          {REFUND_REASONS.map((reason) => (
            <option key={reason} value={reason}>{tRoot(`order.refundReasons.${reason}`)}</option>
          ))}
        </select>
        <label htmlFor="refund-description" className="text-sm font-medium">{t("description")}</label>
        <textarea id="refund-description" rows={4} className="rounded-md border border-slate-300 p-2 text-sm" aria-invalid={descriptionError ? true : undefined} {...form.getFieldProps("description")} />
        {descriptionError && <p role="alert" className="text-sm text-red-600">{tRoot(descriptionError)}</p>}
        {/* RF-12.7 fotos del producto (obligatorias según la política de la tienda) */}
        <label htmlFor="refund-photos" className="text-sm font-medium">{t("photos")}</label>
        <input
          id="refund-photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="text-sm"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).slice(0, 6);
            if (files.length) upload.mutate({ files, folder: "refunds" }, { onSuccess: (assets) => void form.setFieldValue("evidenceUrls", assets.map((asset) => asset.url)), onError: (error) => toast.error(errorMessage(error)) });
          }}
        />
        <p aria-live="polite" className="text-xs text-slate-500">{upload.isPending ? t("uploading") : t("photosCount", { count: form.values.evidenceUrls?.length ?? 0 })}</p>
        {/* RF-12.4 cómo resolver: reembolso, cambio por otra talla/color o crédito en tienda */}
        <label htmlFor="refund-resolution" className="text-sm font-medium">{t("resolution")}</label>
        <select id="refund-resolution" className="h-9 rounded-md border border-slate-300 px-2 text-sm" {...form.getFieldProps("resolution")}>
          {REFUND_RESOLUTIONS.map((value) => <option key={value} value={value}>{t(`resolutions.${value}`)}</option>)}
        </select>
        {form.values.resolution === "EXCHANGE" && (
          <>
            <label htmlFor="refund-variant" className="text-sm font-medium">{t("exchangeVariant")}</label>
            <select id="refund-variant" className="h-9 rounded-md border border-slate-300 px-2 text-sm" {...form.getFieldProps("exchangeVariantId")}>
              <option value="">—</option>
              {(variants.data ?? []).map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
            </select>
          </>
        )}
        <Button type="submit" loading={refund.isPending} disabled={upload.isPending}>{t("submit")}</Button>
      </form>
    </Modal>
  );
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("order.detail");
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const { accessToken } = useAuth();
  const { data: order, isLoading, isError, error } = useOrder(orderId);
  const [dialog, setDialog] = useState<"cancel" | "refund" | null>(null);
  const reorder = useReorder(orderId);
  const resend = useResendInvoice();

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !order) return <p role="alert" className="text-red-600">{errorMessage(error, t("notFound"))}</p>;
  const money = (cents: number) => format.money(cents, order.currency);
  const invoice = order.invoice;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title", { number: order.orderNumber })}</h1>
          <p className="text-sm text-slate-600">{t("placedOn")} <time dateTime={order.placedAt}>{format.dateTime(order.placedAt)}</time> · {t(`channels.${order.channel}`)}</p>
        </div>
        <OrderStatus status={order.status} />
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="items-title">
            <h2 id="items-title" className="mb-3 text-lg font-semibold">{t("items")}</h2>
            <ul className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <div className="w-16 shrink-0"><ProductImage src={item.imageUrl} alt="" sizes="64px" className="rounded-md" /></div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-slate-500">{item.variantName} · x{item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium">{money(item.totalCents)}</p>
                </li>
              ))}
            </ul>
          </section>
          <OrderTracking shipment={order.shipment} />
        </div>

        <aside className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="flex justify-between"><dt>{t("subtotal")}</dt><dd>{money(order.subtotalCents)}</dd></div>
            {order.discountCents > 0 && <div className="flex justify-between text-green-700"><dt>{t("discount")}</dt><dd>−{money(order.discountCents)}</dd></div>}
            <div className="flex justify-between"><dt>{t("shipping")}</dt><dd>{order.shippingCents === 0 ? t("free") : money(order.shippingCents)}</dd></div>
            <div className="flex justify-between"><dt>{t("tax")}</dt><dd>{money(order.taxCents)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><dt>{t("total")}</dt><dd>{money(order.totalCents)}</dd></div>
          </dl>
          <section aria-labelledby="address-title" className="rounded-lg border border-slate-200 p-4 text-sm">
            <h2 id="address-title" className="mb-1 font-semibold">{t("shipTo")}</h2>
            <address className="not-italic text-slate-700">
              {order.shippingAddress.recipientName}<br />
              {order.shippingAddress.line1}{order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state}
            </address>
          </section>
          {invoice && accessToken && (
            <>
              <Button variant="secondary" onClick={() => downloadInvoice(invoice.id, invoice.number, accessToken).catch((err: unknown) => toast.error(errorMessage(err)))}>
                {t("downloadInvoice", { number: invoice.number })}
              </Button>
              {/* RF-11.2 reenviar la factura (PDF + XML) al correo */}
              <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate(invoice.id, { onSuccess: () => toast.success(t("invoiceEmailed")), onError: (err) => toast.error(errorMessage(err)) })}>
                {t("emailInvoice")}
              </Button>
            </>
          )}
          {/* RF-09.4 volver a pedir + imprimir comprobante (window.print: el navegador genera el PDF; la UI se oculta con print:hidden) */}
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="secondary"
              loading={reorder.isPending}
              onClick={() =>
                reorder.mutate(undefined, {
                  onSuccess: (result) => toast.success(result.skipped.length ? t("reorderPartial", { added: result.added, skipped: result.skipped.length }) : t("reorderDone", { added: result.added })),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              {t("reorder")}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>{t("print")}</Button>
          </div>
          {DELIVERY_EDITABLE.includes(order.status) && <DeliveryPreferences order={order} />}
          {/* RF-09.3 regla de tiempo: cancelar solo mientras la ventana sigue abierta */}
          {order.cancellableUntil && new Date(order.cancellableUntil) > new Date() && (
            <>
              <Button variant="danger" onClick={() => setDialog("cancel")} className="print:hidden">{t("cancel")}</Button>
              <p className="text-xs text-slate-500 print:hidden">{t("cancelUntil", { date: format.dateTime(order.cancellableUntil) })}</p>
            </>
          )}
          {order.status === "DELIVERED" && <Button variant="secondary" onClick={() => setDialog("refund")}>{t("requestRefund")}</Button>}
          {order.status === "DELIVERED" && <ProofOfPurchase orderId={order.id} />}
          {/* RF-12.2 seguimiento de cada devolución: estado, recolección, etiqueta, crédito o cambio */}
          {order.refunds.map((refund) => (
            <section key={refund.id} aria-label={t("refundTitle")} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-medium">{t(`refundResolutions.${refund.resolution}`)} · {t(`refundStatuses.${refund.status}`)}</p>
              {refund.returnStatus && <p className="text-slate-600">{t(`returnStatuses.${refund.returnStatus}`)}{refund.pickupScheduledAt ? ` · ${format.date(refund.pickupScheduledAt)}` : ""}{refund.returnCarrier ? ` · ${refund.returnCarrier}` : ""}</p>}
              {refund.storeCreditCode && <p>{t("storeCredit")} <code className="font-semibold">{refund.storeCreditCode}</code></p>}
              {refund.returnTrackingNumber && accessToken && (
                <Button size="sm" variant="secondary" className="self-start print:hidden" onClick={() => downloadRefundLabel(refund.id, accessToken).catch((err: unknown) => toast.error(errorMessage(err)))}>{t("returnLabel")}</Button>
              )}
            </section>
          ))}
        </aside>
      </div>

      <CancelDialog orderId={order.id} open={dialog === "cancel"} onClose={() => setDialog(null)} />
      <RefundDialog orderId={order.id} productIds={order.items.map((item) => item.productId).filter((id): id is string => Boolean(id))} open={dialog === "refund"} onClose={() => setDialog(null)} />
    </div>
  );
}
