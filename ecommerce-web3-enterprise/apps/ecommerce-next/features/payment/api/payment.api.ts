// payment.api.ts => pagos: crear/reutilizar el PaymentIntent de Stripe y consultar el historial de pagos.
"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-client";
import { apiRequest } from "@/shared/lib/api-client";
import { useAuth } from "@/shared/hook/useAuth";
import type { PaginationMeta } from "@/shared/types/api.types";

export interface PaymentIntentData {
  paymentId: string;
  clientSecret: string; // Solo permite confirmar ESTE pago desde el navegador (no es una credencial del comercio)
  amountCents: number;
  currency: string;
}

export interface PaymentRecord {
  id: string;
  checkoutSessionId: string;
  orderId: string | null;
  amountCents: number;
  refundedCents: number;
  currency: string;
  status: "PENDING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  failureReason: string | null;
  createdAt: string;
}

// usePaymentIntent => POST /payment/process crea (o reutiliza) el PaymentIntent en Stripe: es una escritura, por eso
// useMutation. Idempotente en el backend: recargar la página reutiliza el mismo intent. "ready" => hay token de sesión
export function usePaymentIntent() {
  const { accessToken } = useAuth();
  const mutation = useMutation({
    mutationFn: (checkoutSessionId: string) =>
      apiRequest<PaymentIntentData>("/payment/process", { method: "POST", token: accessToken, body: { checkoutSessionId } }).then((response) => response.data),
    retry: false,
  });
  return { ...mutation, ready: Boolean(accessToken) };
}

// usePayments => historial de pagos del usuario (Account hub)
export function usePayments(page: number) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["payments", page],
    queryFn: () => apiRequest<PaymentRecord[]>("/payment", { token: accessToken, query: { page, limit: 10 } }) as Promise<{ data: PaymentRecord[]; meta?: PaginationMeta }>,
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
  });
}

// ---------- RF-02.3 Métodos de pago guardados (tokenizados en Stripe) ----------
// SavedPaymentMethod => solo datos de presentación: la tarjeta completa nunca llega a nuestro sistema (PCI SAQ-A)
export interface SavedPaymentMethod {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

// useSavedPaymentMethods => lectura (useQuery) + mutaciones que invalidan SOLO esta lista (TanStack Query)
export function useSavedPaymentMethods() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods });
  const list = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: () => apiRequest<SavedPaymentMethod[]>("/payment/methods", { token: accessToken }).then((response) => response.data),
    enabled: Boolean(accessToken),
  });
  return {
    list,
    refresh,
    // createSetupIntent => client_secret para que Stripe Elements tokenice el método en el navegador
    createSetupIntent: useMutation({ mutationFn: () => apiRequest<{ clientSecret: string }>("/payment/methods/setup-intent", { method: "POST", token: accessToken }).then((response) => response.data) }),
    makeDefault: useMutation({ mutationFn: (id: string) => apiRequest(`/payment/methods/${id}`, { method: "PATCH", token: accessToken }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => apiRequest(`/payment/methods/${id}`, { method: "DELETE", token: accessToken }), onSuccess: refresh }),
  };
}

// ---------- RF-08.3 / RF-08.9 otros medios de pago ----------

// StorePaymentOptions => medios habilitados por el administrador (GET /cms/config, versión pública)
export interface StorePaymentOptions {
  stripe: boolean;
  bankTransfer: boolean;
  cashOnDelivery: boolean;
  crypto: { enabled: boolean; networks: string[] };
}
type PublicPaymentConfig = { stripe?: { enabled?: boolean }; crypto?: { enabled?: boolean; networks?: string[] }; cashOnDelivery?: boolean; bankTransfer?: { enabled?: boolean } } | null;

// toPaymentOptions => Adapter: el staff recibe la configuración completa (arreglo por sección) y el cliente la pública
function toPaymentOptions(raw: unknown): StorePaymentOptions {
  const payment = (Array.isArray(raw) ? (raw.find((entry: { section?: string }) => entry.section === "payment") as { value?: unknown } | undefined)?.value : (raw as { payment?: unknown } | null)?.payment) as PublicPaymentConfig;
  const networks = payment?.crypto?.networks ?? [];
  return {
    stripe: payment?.stripe?.enabled ?? true, // Sin configuración guardada, Stripe sigue siendo el medio por defecto
    bankTransfer: payment?.bankTransfer?.enabled ?? false,
    cashOnDelivery: payment?.cashOnDelivery ?? false,
    crypto: { enabled: payment?.crypto?.enabled ?? false, networks: networks.map((entry) => (typeof entry === "string" ? entry : (entry as { network: string }).network)) },
  };
}

export function usePaymentOptions() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["payment-options"],
    queryFn: async () => toPaymentOptions((await apiRequest<unknown>("/cms/config", { token: accessToken })).data),
    staleTime: 5 * 60_000,
  });
}

// OfflinePayment => respuesta de transferencia / contra entrega / cotización cripto
export interface OfflinePayment {
  paymentId: string;
  provider: "BANK_TRANSFER" | "CASH_ON_DELIVERY" | "CRYPTO";
  status: string;
  details: Record<string, string | number>;
  orderId: string | null;
}

// useOfflinePayment => POST /payment/offline (transferencia o contra entrega)
export function useOfflinePayment() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (input: { checkoutSessionId: string; method: "BANK_TRANSFER" | "CASH_ON_DELIVERY" }) =>
      apiRequest<OfflinePayment>("/payment/offline", { method: "POST", token: accessToken, body: input }).then((response) => response.data),
  });
}

// useCryptoQuote / useCryptoConfirm => RF-08.9 cotizar en cripto (tasa en vivo) y confirmar con el hash on-chain
export function useCryptoQuote() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (input: { checkoutSessionId: string; asset: string; network: string }) =>
      apiRequest<OfflinePayment>("/payment/crypto/quote", { method: "POST", token: accessToken, body: input }).then((response) => response.data),
  });
}
export function useCryptoConfirm() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (input: { paymentId: string; txHash: string }) =>
      apiRequest<{ orderId: string }>(`/payment/crypto/${input.paymentId}/confirm`, { method: "POST", token: accessToken, body: { txHash: input.txHash } }).then((response) => response.data),
  });
}
