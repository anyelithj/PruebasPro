// SavedPaymentMethods.tsx (Client Component · React + Stripe Elements + TanStack Query + Tailwind) => RF-02.3 métodos de
// pago guardados: listar, agregar (SetupIntent: Stripe tokeniza la tarjeta en SU iframe), marcar predeterminado y eliminar.
// Seguridad: el número y el CVC nunca pasan por nuestro código ni servidores (PCI DSS SAQ-A); solo se ven marca y 4 dígitos.
// Patrones: Facade (useSavedPaymentMethods), Composite (lista de tarjetas), Lazy Loading (Stripe.js y el SetupIntent solo
// se piden al pulsar "Agregar"). Accesibilidad: lista semántica, acciones con nombre accesible, confirmación nativa.
"use client"; // Directiva de Next.js: usa hooks y Stripe.js => Client Component

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"; // Componentes oficiales de Stripe
import { useSavedPaymentMethods } from "../api/payment.api";
import { getStripe } from "./StripePayment"; // Singleton de Stripe.js (una descarga por página)
import { config } from "@/shared/constants/config";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { Skeleton } from "@/shared/ui/Skeleton";
import { toast } from "@/shared/ui/Toast";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";

// SetupForm => debe vivir DENTRO de <Elements> para usar useStripe/useElements (contexto de Stripe)
function SetupForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("settings.payments");
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!stripe || !elements) return; // Stripe.js aún cargando
    setSaving(true);
    // "confirmSetup" => Stripe valida y tokeniza; "if_required" => solo redirige si el método lo exige (3-D Secure)
    const result = await stripe.confirmSetup({ elements, redirect: "if_required", confirmParams: { return_url: window.location.href } });
    setSaving(false);
    if (result.error) return setError(result.error.message ?? null);
    onDone();
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button loading={saving} disabled={!stripe} onClick={() => void save()}>{t("save")}</Button>
        <Button variant="secondary" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </div>
  );
}

export function SavedPaymentMethods() {
  const t = useTranslations("settings.payments");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { list, refresh, createSetupIntent, makeDefault, remove } = useSavedPaymentMethods();
  const [clientSecret, setClientSecret] = useState<string | null>(null); // SetupIntent abierto (formulario visible)
  const onError = (error: unknown) => toast.error(errorMessage(error));

  return (
    <section aria-labelledby="payments-title" className="flex max-w-md flex-col gap-3">
      <h2 id="payments-title" className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-sm text-slate-600">{t("description")}</p>

      {list.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : list.data?.length ? (
        <ul className="flex flex-col gap-2">
          {list.data.map((method) => {
            const name = `${(method.brand ?? method.type).toUpperCase()} •••• ${method.last4 ?? "—"}`;
            return (
              <li key={method.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
                <span className="font-medium tabular-nums">{name}</span>
                {method.expMonth && method.expYear && (
                  <span className="text-xs text-slate-500">{t("expires", { month: String(method.expMonth).padStart(2, "0"), year: method.expYear })}</span>
                )}
                {method.isDefault && <Badge tone="info">{t("default")}</Badge>}
                <span className="ml-auto flex gap-2">
                  {!method.isDefault && (
                    <Button size="sm" variant="ghost" loading={makeDefault.isPending && makeDefault.variables === method.id} onClick={() => makeDefault.mutate(method.id, { onSuccess: () => toast.success(t("defaultSaved")), onError })}>
                      {t("makeDefault")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="dangerOutline"
                    aria-label={t("removeLabel", { brand: method.brand ?? method.type, last4: method.last4 ?? "" })}
                    loading={remove.isPending && remove.variables === method.id}
                    // "window.confirm" => diálogo nativo accesible (0 KB de JS extra)
                    onClick={() => window.confirm(t("confirmRemove")) && remove.mutate(method.id, { onSuccess: () => toast.success(t("removed")), onError })}
                  >
                    ✕
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{t("empty")}</p>
      )}

      {!config.stripePublishableKey ? (
        <p className="text-sm text-amber-700">{t("unavailable")}</p>
      ) : clientSecret ? (
        // "Elements" con el client_secret del SetupIntent: el PaymentElement muestra los métodos que se pueden guardar
        <Elements stripe={getStripe()} options={{ clientSecret, locale: locale === "en" ? "en" : "es", appearance: { theme: "stripe", variables: { colorPrimary: "#0f172a" } } }}>
          <SetupForm onCancel={() => setClientSecret(null)} onDone={() => { setClientSecret(null); toast.success(t("saved")); refresh(); }} />
        </Elements>
      ) : (
        <Button variant="secondary" className="self-start" loading={createSetupIntent.isPending} onClick={() => createSetupIntent.mutate(undefined, { onSuccess: (intent) => setClientSecret(intent.clientSecret), onError })}>
          {t("add")}
        </Button>
      )}
    </section>
  );
}
