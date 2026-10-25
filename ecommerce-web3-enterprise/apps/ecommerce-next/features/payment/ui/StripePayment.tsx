// StripePayment.tsx (Stripe Elements) => formulario de pago PCI-compliant: los datos de la tarjeta se capturan en
// un iframe de Stripe (nunca tocan nuestro código ni servidores => alcance PCI SAQ-A).
// Tras confirmar, Stripe redirige a "returnUrl" (necesario para 3-D Secure y métodos con redirección como PSE).
"use client";

import { useEffect, useRef } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Link } from "@/shared/lib/i18n/navigation";
import { usePaymentIntent } from "../api/payment.api";
import { usePaymentProcessing } from "../model/payment.store";
import { paymentConsentSchema, type PaymentConsentValues } from "../lib/payment.validator";
import { config } from "@/shared/constants/config";
import { useLocale, useTranslations } from "next-intl";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { useZodForm } from "@/shared/hook/useZodForm";
import { trackEvent } from "@/shared/lib/analytics";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";

// Singleton perezoso: loadStripe descarga Stripe.js UNA vez por carga de página (fuera del render de React)
let stripePromise: Promise<Stripe | null> | null = null;
export const getStripe = () => (stripePromise ??= loadStripe(config.stripePublishableKey)); // Compartido con SavedPaymentMethods (DRY)

// Formulario interno: necesita estar DENTRO de <Elements> para usar useStripe/useElements
function PaymentFields({ amount, currency, returnUrl, paymentId }: { amount: number; currency: string; returnUrl: string; paymentId: string }) {
  const t = useTranslations("payment.form");
  const tRoot = useTranslations();
  const { money } = useFormat();
  const stripe = useStripe();
  const elements = useElements();
  const { processingIntentId, start, finish } = usePaymentProcessing();
  const form = useZodForm({
    schema: paymentConsentSchema,
    initialValues: { acceptTerms: false },
    onSubmit: async (_values: PaymentConsentValues, helpers) => {
      if (!stripe || !elements) return; // Stripe.js aún cargando
      start(paymentId);
      trackEvent("add_payment_info", { value: amount / 100, currency });
      // "confirmPayment" => Stripe autentica (3DS) y redirige a returnUrl; solo vuelve aquí si hubo un error inmediato
      const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
      finish();
      // "status" => estado libre de Formik para errores de TODO el formulario (no de un campo)
      helpers.setStatus(error ? (error.message ?? t("failed")) : undefined); // Stripe ya devuelve el mensaje en el idioma del formulario
    },
  });
  const termsError = form.error("acceptTerms");
  const paymentError: unknown = form.status;

  return (
    <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-4">
      {/* PaymentElement => UI de Stripe con los métodos habilitados (tarjeta, wallets, PSE...) y accesibilidad incluida */}
      <PaymentElement options={{ layout: "tabs" }} />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        {/* type: "checkbox" => Formik entrega "checked" (boolean) en vez de "value" */}
        <input type="checkbox" className="mt-1 h-4 w-4" aria-invalid={termsError ? true : undefined} {...form.getFieldProps({ name: "acceptTerms", type: "checkbox" })} />
        <span>
          {t.rich("terms", { link: (chunk) => (<Link href="/terms" className="underline">{chunk}</Link>) })}
        </span>
      </label>
      {termsError && <p role="alert" className="text-sm text-red-600">{tRoot(termsError)}</p>}
      {typeof paymentError === "string" && <p role="alert" className="text-sm text-red-600">{paymentError}</p>}
      <Button type="submit" size="lg" loading={processingIntentId === paymentId} disabled={!stripe}>
        {t("pay", { amount: money(amount, currency) })}
      </Button>
    </form>
  );
}

export function StripePayment({ checkoutSessionId, returnUrl }: { checkoutSessionId: string; returnUrl: string }) {
  const t = useTranslations("payment.form");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { data: intent, isError, error, ready, mutate: createIntent } = usePaymentIntent();
  // "useRef" => el intent se pide UNA vez (React StrictMode ejecuta los efectos dos veces en desarrollo)
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    createIntent(checkoutSessionId);
  }, [ready, createIntent, checkoutSessionId]);

  if (!config.stripePublishableKey) return <p role="alert" className="text-sm text-red-600">{t("notConfigured")}</p>;
  if (isError) return <p role="alert" className="text-sm text-red-600">{errorMessage(error, t("initFailed"))}</p>;
  if (!intent) return <Skeleton className="h-64 w-full" />;

  return (
    // "Elements" => contexto de Stripe con el client_secret y el tema visual alineado a la marca
    <Elements stripe={getStripe()} options={{ clientSecret: intent.clientSecret, locale: locale === "en" ? "en" : "es", // Formulario de Stripe en el idioma del sitio
        appearance: { theme: "stripe", variables: { colorPrimary: "#0f172a" } } }}>
      <PaymentFields amount={intent.amountCents} currency={intent.currency} returnUrl={returnUrl} paymentId={intent.paymentId} />
    </Elements>
  );
}
