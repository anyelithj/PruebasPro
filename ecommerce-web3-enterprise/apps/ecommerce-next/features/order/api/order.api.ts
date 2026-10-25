// order.api.ts => pedidos del usuario (lista/detalle), cancelación, devoluciones y descarga de factura.
"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiRequest } from "@/shared/lib/api-client";
import { queryKeys } from "@/shared/lib/query-client";
import { useAuth } from "@/shared/hook/useAuth";
import { config } from "@/shared/constants/config";
import type { PaginationMeta } from "@/shared/types/api.types";
import type { OrderDetail, OrderStatus, OrderSummary, ShipmentTracking } from "@/entities/order/model/order.types";
import type { RefundFormValues } from "../lib/order.validator";

export function useOrders(params: { page: number; status?: OrderStatus | undefined }) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: () => apiRequest<OrderSummary[]>("/order", { token: accessToken, query: { page: params.page, limit: 10, status: params.status } }) as Promise<{ data: OrderSummary[]; meta?: PaginationMeta }>,
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => apiGet<OrderDetail>(`/order/${id}`, { token: accessToken, cache: "no-store" }),
    enabled: Boolean(accessToken),
    // Mientras el pedido está en tránsito se refresca cada minuto (el tracking cambia)
    refetchInterval: (query) => (query.state.data && ["SHIPPED", "PACKED"].includes(query.state.data.status) ? 60_000 : false),
  });
}

// ProofNft => RF-29.3 NFT de prueba de compra (ERC-721) del pedido entregado
export interface ProofNft {
  status: "PENDING" | "MINTED" | "FAILED";
  ownerAddress: string;
  orderHash: string; // SHA-256 del pedido: verificable sin exponer datos personales
  contractAddress: string | null;
  tokenId: string | null;
  txHash: string | null;
  failureReason: string | null;
  mintedAt: string | null;
}

// useProofNft / useMintProofNft => GET (estado) y POST (emitir o reintentar) /order/:id/proof-nft; solo si fue entregado
export function useProofNft(id: string, delivered: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.order(id), "proof-nft"],
    queryFn: () => apiGet<ProofNft | null>(`/order/${id}/proof-nft`, { token: accessToken, cache: "no-store" }),
    enabled: Boolean(accessToken) && delivered,
  });
}
export function useMintProofNft(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<ProofNft>(`/order/${id}/proof-nft`, { method: "POST", token: accessToken }).then((response) => response.data),
    onSuccess: (proof) => queryClient.setQueryData([...queryKeys.order(id), "proof-nft"], proof),
  });
}

// useCancelOrder => DELETE /order/:id (solo antes del envío; el backend reembolsa automáticamente)
export function useCancelOrder(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => apiRequest<OrderDetail>(`/order/${id}`, { method: "DELETE", token: accessToken, body: { reason } }).then((response) => response.data),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(id), order);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

// useShipmentTracking => RF-09.1/10.5 mapa del paquete + RF-09.3 contacto con la transportadora
export function useShipmentTracking(shipmentId: string | undefined) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["shipment-tracking", shipmentId],
    queryFn: () => apiGet<ShipmentTracking>(`/shipping/${shipmentId}/tracking`, { token: accessToken, cache: "no-store" }),
    enabled: Boolean(accessToken && shipmentId),
    staleTime: 5 * 60_000,
  });
}

// useUpdateDelivery => PATCH /order/:id/delivery (RF-09.3 reprogramar entrega e instrucciones al mensajero)
export function useUpdateDelivery(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { preferredDeliveryDate?: string | null; deliveryInstructions?: string | null }) =>
      apiRequest<OrderDetail>(`/order/${id}/delivery`, { method: "PATCH", token: accessToken, body }).then((response) => response.data),
    onSuccess: (order) => queryClient.setQueryData(queryKeys.order(id), order),
  });
}

// useReorder => POST /order/:id/reorder (RF-09.4 volver a pedir): agrega al carrito lo que aún se vende
export function useReorder(id: string) {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ added: number; skipped: Array<{ productName: string; reason: string }> }>(`/order/${id}/reorder`, { method: "POST", token: accessToken }).then((response) => response.data),
  });
}

// useResendInvoice => POST /invoice/:id/email (RF-11.2 reenviar la factura al correo)
export function useResendInvoice() {
  const { accessToken } = useAuth();
  return useMutation({ mutationFn: (invoiceId: string) => apiRequest(`/invoice/${invoiceId}/email`, { method: "POST", token: accessToken }) });
}

// useProductVariants => variantes de un producto (RF-12.4 cambio por otra talla o color)
export function useProductVariants(productId: string | null) {
  return useQuery({
    queryKey: ["product-variants", productId],
    queryFn: () => apiGet<{ variants: Array<{ id: string; name: string; stock?: number; available?: number }> }>(`/product/${productId}`).then((product) => product.variants),
    enabled: Boolean(productId),
  });
}

// downloadRefundLabel => RF-12.2 etiqueta PDF de la recolección (requiere Authorization: blob)
export async function downloadRefundLabel(refundId: string, token: string): Promise<void> {
  const response = await fetch(`${config.apiUrl}/refund/${refundId}/label`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No se pudo descargar la etiqueta");
  const url = URL.createObjectURL(await response.blob());
  Object.assign(document.createElement("a"), { href: url, download: `devolucion-${refundId}.pdf` }).click();
  URL.revokeObjectURL(url);
}

// useRequestRefund => POST /refund (devolución de un pedido entregado)
export function useRequestRefund(orderId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    // "|| undefined" => sin variante elegida no se envía el campo (Express exige UUID si llega)
    mutationFn: (values: RefundFormValues) => apiRequest("/refund", { method: "POST", token: accessToken, body: { ...values, exchangeVariantId: values.exchangeVariantId || undefined, orderId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) }),
  });
}

// downloadInvoice => el PDF requiere Authorization: se descarga con fetch y se abre como blob (no un <a href> directo)
export async function downloadInvoice(invoiceId: string, number: string, token: string): Promise<void> {
  const response = await fetch(`${config.apiUrl}/invoice/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No se pudo descargar la factura");
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement("a"), { href: url, download: `factura-${number}.pdf` });
  link.click();
  URL.revokeObjectURL(url); // Libera la memoria del blob
}
