// PaymentMethods.tsx (Client Component · React + TanStack Query + Tailwind) => RF-08.3 selector de medio de pago del
// checkout: tarjeta/PSE/wallets (Stripe Elements), transferencia bancaria, contra entrega y criptomonedas (BTC, ETH,
// USDT, USDC con conversión automática a moneda local, RF-08.9). Solo se muestran los medios que el administrador
// habilitó (GET /cms/config). Patrones: Strategy (un panel por medio, tabla PANELS) + Facade (hooks de payment.api).
// Accesibilidad: radios nativos en <fieldset>/<legend>, mensajes con role="alert"/"status", foco visible.
"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useCryptoConfirm, useCryptoQuote, useOfflinePayment, usePaymentOptions, type OfflinePayment } from "../api/payment.api";
import { StripePayment } from "./StripePayment";
import { useRouter } from "@/shared/lib/i18n/navigation";
import { routes } from "@/shared/constants/routes";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Skeleton } from "@/shared/ui/Skeleton";

type Method = "CARD" | "BANK_TRANSFER" | "CASH_ON_DELIVERY" | "CRYPTO";
// Combinaciones activo/red que acepta el backend (crypto-payment.util.ts)
const CRYPTO_OPTIONS = [
  { asset: "BTC", network: "bitcoin" },
  { asset: "ETH", network: "ethereum" },
  { asset: "USDT", network: "ethereum" },
  { asset: "USDT", network: "polygon" },
  { asset: "USDC", network: "ethereum" },
  { asset: "USDC", network: "polygon" },
] as const;

export function PaymentMethods({ checkoutSessionId, returnUrl }: { checkoutSessionId: string; returnUrl: string }) {
  const t = useTranslations("payment.methods");
  const { data: options, isLoading } = usePaymentOptions();
  const [method, setMethod] = useState<Method>("CARD");
  if (isLoading || !options) return <Skeleton className="h-40 w-full" />;

  // available => medios activos (la tarjeta siempre primero: es el medio por defecto)
  const available: Method[] = [
    ...(options.stripe ? (["CARD"] as const) : []),
    ...(options.bankTransfer ? (["BANK_TRANSFER"] as const) : []),
    ...(options.cashOnDelivery ? (["CASH_ON_DELIVERY"] as const) : []),
    ...(options.crypto.enabled && options.crypto.networks.length > 0 ? (["CRYPTO"] as const) : []),
  ];
  const current = available.includes(method) ? method : (available[0] ?? "CARD");
  // PANELS => estrategia de render por medio de pago (agregar un medio = agregar una entrada: OCP)
  const PANELS: Record<Method, ReactNode> = {
    CARD: <StripePayment checkoutSessionId={checkoutSessionId} returnUrl={returnUrl} />,
    BANK_TRANSFER: <OfflinePanel checkoutSessionId={checkoutSessionId} method="BANK_TRANSFER" />,
    CASH_ON_DELIVERY: <OfflinePanel checkoutSessionId={checkoutSessionId} method="CASH_ON_DELIVERY" />,
    CRYPTO: <CryptoPanel checkoutSessionId={checkoutSessionId} networks={options.crypto.networks} />,
  };

  return (
    <div className="flex flex-col gap-4">
      {available.length > 1 && (
        <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <legend className="sr-only">{t("legend")}</legend>
          {available.map((value) => (
            <label key={value} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 p-3 text-center text-sm font-medium has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-900">
              <input type="radio" name="payment-method" value={value} checked={current === value} onChange={() => setMethod(value)} className="sr-only" />
              {t(`names.${value}`)}
            </label>
          ))}
        </fieldset>
      )}
      {PANELS[current]}
    </div>
  );
}

// OfflinePanel => transferencia (muestra los datos para consignar) o contra entrega (coloca el pedido de inmediato)
function OfflinePanel({ checkoutSessionId, method }: { checkoutSessionId: string; method: "BANK_TRANSFER" | "CASH_ON_DELIVERY" }) {
  const t = useTranslations("payment.methods");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pay = useOfflinePayment();
  const result = pay.data;

  if (result?.provider === "BANK_TRANSFER") return <BankInstructions payment={result} />;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 text-sm">
      <p className="text-slate-700">{t(method === "BANK_TRANSFER" ? "bankIntro" : "codIntro")}</p>
      {pay.isError && <p role="alert" className="text-red-600">{errorMessage(pay.error)}</p>}
      <Button
        size="lg"
        loading={pay.isPending}
        onClick={() => pay.mutate({ checkoutSessionId, method }, { onSuccess: (payment) => payment.orderId && router.push(routes.order(payment.orderId)) })}
      >
        {t(method === "BANK_TRANSFER" ? "bankSubmit" : "codSubmit")}
      </Button>
    </div>
  );
}

// BankInstructions => datos de la cuenta + referencia + fecha límite (lista de definición: semántica de pares)
function BankInstructions({ payment }: { payment: OfflinePayment }) {
  const t = useTranslations("payment.methods");
  const format = useFormat();
  const d = payment.details;
  const rows: Array<[string, string]> = [
    [t("bank.bankName"), String(d["bankName"] ?? "")],
    [t("bank.accountType"), String(d["accountType"] ?? "")],
    [t("bank.accountNumber"), String(d["accountNumber"] ?? "")],
    [t("bank.holder"), `${String(d["holder"] ?? "")} · ${String(d["holderId"] ?? "")}`],
    [t("bank.reference"), String(d["reference"] ?? "")],
    [t("bank.amount"), format.money(Number(d["amountCents"] ?? 0), String(d["currency"] ?? "COP"))],
    [t("bank.payBefore"), format.dateTime(String(d["payBefore"] ?? new Date().toISOString()))],
  ];
  return (
    <section role="status" aria-labelledby="bank-title" className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <h3 id="bank-title" className="font-semibold">{t("bank.title")}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-600">{label}</dt>
            <dd className="font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-slate-700">{t("bank.note")}</p>
    </section>
  );
}

// CryptoPanel => 1) elegir activo y red, 2) cotización en vivo (monto, dirección, tasa), 3) pegar el hash y verificar
function CryptoPanel({ checkoutSessionId, networks }: { checkoutSessionId: string; networks: string[] }) {
  const t = useTranslations("payment.methods");
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const router = useRouter();
  const choices = CRYPTO_OPTIONS.filter((option) => networks.includes(option.network));
  const [choice, setChoice] = useState(0);
  const [txHash, setTxHash] = useState("");
  const quote = useCryptoQuote();
  const confirm = useCryptoConfirm();
  const selected = choices[choice];
  if (!selected) return <p className="text-sm text-slate-600">{t("cryptoUnavailable")}</p>;
  const q = quote.data?.details;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t("cryptoAsset")}</span>
        <select value={choice} onChange={(event) => { setChoice(Number(event.target.value)); quote.reset(); }} className="h-9 rounded-md border border-slate-300 px-2">
          {choices.map((option, index) => (
            <option key={`${option.asset}-${option.network}`} value={index}>{`${option.asset} · ${option.network}`}</option>
          ))}
        </select>
      </label>
      {!q ? (
        <Button loading={quote.isPending} onClick={() => quote.mutate({ checkoutSessionId, asset: selected.asset, network: selected.network })}>{t("cryptoQuote")}</Button>
      ) : (
        <>
          {/* Cotización: el comprador envía EXACTAMENTE este monto a esta dirección antes del vencimiento */}
          <dl className="grid grid-cols-1 gap-y-1 rounded-md bg-slate-50 p-3 sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-slate-600">{t("cryptoAmount")}</dt>
            <dd className="font-mono font-semibold">{`${String(q["amount"])} ${String(q["asset"])}`}</dd>
            <dt className="text-slate-600">{t("cryptoAddress")}</dt>
            <dd className="break-all font-mono">{String(q["address"])}</dd>
            <dt className="text-slate-600">{t("cryptoRate")}</dt>
            <dd>{`1 ${String(q["asset"])} = ${format.money(Math.round(Number(q["rate"]) * 100), String(q["currency"]))}`}</dd>
            <dt className="text-slate-600">{t("cryptoExpires")}</dt>
            <dd>{format.dateTime(String(q["expiresAt"]))}</dd>
          </dl>
          <Input label={t("cryptoTxHash")} value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
          <Button
            size="lg"
            loading={confirm.isPending}
            disabled={txHash.trim().length < 64}
            onClick={() => quote.data && confirm.mutate({ paymentId: quote.data.paymentId, txHash: txHash.trim() }, { onSuccess: (result) => router.push(routes.order(result.orderId)) })}
          >
            {t("cryptoConfirm")}
          </Button>
        </>
      )}
      {(quote.isError || confirm.isError) && <p role="alert" className="text-red-600">{errorMessage(quote.error ?? confirm.error)}</p>}
    </div>
  );
}
