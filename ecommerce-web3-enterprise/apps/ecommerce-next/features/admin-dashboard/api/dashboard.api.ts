// dashboard.api.ts => llamadas REST (Axios) a las APIs admin de Express + TanStack Query (Server State) del panel.
// Patrones: Repository/Gateway (único acceso HTTP del panel), Factory de hooks genéricos (useAdminList, useAdminGet,
// useAdminMutation: DRY para los ~15 recursos admin) y Observer (useLiveMetrics: Socket.io "analytics:tick").
// Regla del proyecto: los datos del servidor viven en TanStack Query (nunca en Redux); cada mutación invalida SOLO
// las consultas de su recurso => menos peticiones (ahorro de red y batería).
"use client";

import { useEffect, useRef } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/shared/lib/api-client";
import { queryKeys } from "@/shared/lib/query-client";
import { useAuth } from "@/shared/hook/useAuth";
import { config } from "@/shared/constants/config";
import type { PaginationMeta } from "@/shared/types/api.types";

// Valores admitidos en la query string (mismo contrato que api-client)
export type Query = Record<string, string | number | boolean | undefined | null | string[]>;
export interface Page<T> {
  data: T[];
  meta?: PaginationMeta | undefined;
}

// ---------- Contratos (forma JSON de los DTO de Express: fechas como string ISO) ----------

export interface Kpi {
  value: number;
  previous: number;
  change: number;
}
export interface MetricPoint {
  period: string;
  revenueCents: number;
  orders: number;
  aovCents: number;
  sessions: number;
  pageViews: number;
  addToCart: number;
  purchases: number;
  conversionRate: number;
}
export interface ReportRow {
  key: string;
  label: string;
  value: number;
  units?: number;
  views?: number;
  addToCart?: number;
}
export interface KpiResponse {
  from: string;
  to: string;
  generatedAt: string;
  kpis: Record<"revenueCents" | "orders" | "aovCents" | "newCustomers" | "conversionRate", Kpi>;
  operations: { activeOrders: number; pendingRefunds: number; lowStock: number };
  series: MetricPoint[];
  topProducts: ReportRow[];
}
// VendorKpiResponse => GET /dashboard/vendor (portada del VENDEDOR: solo sus productos y pedidos)
export interface VendorKpiResponse {
  from: string;
  to: string;
  kpis: Record<"revenueCents" | "orders" | "units", Kpi>;
  products: Record<"DRAFT" | "ACTIVE" | "ARCHIVED", number>;
  operations: { activeOrders: number; lowStock: number };
  topProducts: Array<{ name: string; revenueCents: number; units: number }>;
}
export interface MetricsResponse {
  series: MetricPoint[];
  totals: Omit<MetricPoint, "period">;
  funnel: Array<{ step: string; count: number; rate: number }>;
  cartAbandonmentRate: number;
}
export interface Widget {
  id: string | null;
  type: "KPI" | "SALES_CHART" | "TOP_PRODUCTS" | "LOW_STOCK" | "FUNNEL" | "RECENT_ORDERS";
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
}
export interface StockLevel {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  variantName: string;
  stock: number;
  reserved: number;
  available: number;
  low: boolean;
  imageUrl?: string | null;
}
export interface Movement {
  id: string;
  type: string;
  delta: number;
  quantity: number;
  warehouse: string;
  reason: string;
  stockAfter: number;
  voidedAt: string | null;
  createdAt: string;
}
export interface InventoryDetail extends StockLevel {
  movements: Movement[];
  forecast: { avgDailySales: number; daysOfCover: number | null; reorderQuantity: number };
}
export interface Supplier {
  id: string;
  name: string;
  taxId: string;
  email: string;
  phone: string | null;
  contactName: string | null;
  paymentTermsDays: number;
  leadTimeDays: number;
  rating: number | null;
  isActive: boolean;
  contractEndsAt: string | null;
  contractAlert: boolean;
}
export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  orders: number;
  ltvCents: number;
  lastOrderAt: string | null;
  segment: "VIP" | "REGULAR" | "NEW" | "INACTIVE";
  score: { value: number; source: "MANUAL" | "RFM" };
  tags: string[];
  archived: boolean;
  createdAt: string;
}
export interface Customer360 extends Customer {
  notes: Array<{ text: string; authorId: string; at: string }>;
  recentOrders: Array<{ id: string; orderNumber: string; status: string; totalCents: number; currency: string; placedAt: string }>;
  favoriteCategories: Array<{ name: string; units: number }>;
  loyalty: { tier: string; pointsBalance: number } | null;
  reviews: number;
  avgOrderCents: number;
  nextPurchaseAt: string | null;
}
export interface Campaign {
  id: string;
  name: string;
  channel: "EMAIL" | "PUSH" | "WHATSAPP";
  audience: string;
  subject: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  metrics: { targeted: number; sent: number; failed: number; opened: number; openRate: number; clicked: number; clickRate: number; conversions: number; revenueCents: number; roi: number | null };
  costCents: number; // RF-24.3
  abTest: { subjectB: string; contentB: string | null; testPercent: number; metric: "OPEN" | "CLICK"; waitHours: number; decideAt: string | null; winner: "A" | "B" | null; results?: Record<"A" | "B", { sent: number; opened: number; clicked: number }> } | null; // RF-21.4
  error: string | null;
}
export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: string;
  openCount: number;
  openedAt: string | null;
  clickCount: number; // RF-21.5
  convertedAt: string | null;
  createdAt: string;
}
// EmailBlock => mismo contrato que BlockSchema de Express (unión discriminada por "type")
export type EmailBlock =
  | { type: "heading"; text: string; align: "left" | "center" }
  | { type: "text"; text: string }
  | { type: "image"; src: string; alt: string; href?: string }
  | { type: "button"; label: string; href: string; color: string }
  | { type: "product"; name: string; price: string; imageUrl: string; href: string }
  | { type: "divider" }
  | { type: "spacer"; height: number };

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  variables: string[];
  blocks: EmailBlock[] | null; // RF-21.6 diseño visual
  locale: "es" | "en";
}
export interface Coupon {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  usedCount: number;
  usageLimit: number | null;
  endsAt: string | null;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
  segments: Array<"BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "PLATINUM">;
  origin: string;
}
// Promotion => RF-13 promoción automática
export interface Promotion {
  id: string;
  name: string;
  type: "BUY_X_PAY_Y" | "PERCENT_OFF" | "TIERED" | "FLASH";
  buyQuantity: number | null;
  payQuantity: number | null;
  percent: number | null;
  tiers: Array<{ minQty: number; percent: number }> | null;
  categoryIds: string[];
  brandIds: string[];
  collectionIds: string[];
  priority: number;
  stackable: boolean;
  campaign: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}
export interface PointsMultiplier {
  id: string;
  name: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}
export interface DianResolution {
  id: string;
  resolutionNumber: string;
  prefix: string;
  fromNumber: number;
  toNumber: number;
  nextNumber: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  remaining: number;
  daysLeft: number;
  alerts: string[];
}
export interface Workflow {
  id: string;
  name: string;
  triggerType: string;
  event: string | null;
  active: boolean;
  lastRunAt: string | null;
  metrics: { runs: number; successRate: number; avgDurationMs: number };
}
export interface Shipment {
  id: string;
  orderNumber: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
}
export interface Invoice {
  id: string;
  number: string;
  status: string;
  currency: string;
  totalCents: number;
  issuedAt: string | null;
}
export interface Refund {
  resolution: "REFUND" | "EXCHANGE" | "STORE_CREDIT";
  returnStatus: string | null;
  returnTrackingNumber: string | null;
  pickupScheduledAt: string | null;
  id: string;
  orderNumber: string;
  reason: string;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}
export interface Role {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null; // RF-03.1 hereda permisos de este rol
  parentName: string | null;
  permissions: Array<{ id: string; action: string; resource: string }>;
}
export interface Permission {
  id: string;
  action: string;
  resource: string;
}
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  maxAttempts: number;
  metrics: { deliveries: number; successRate: number; avgDurationMs: number };
  secret?: string;
}
export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  module: string;
  source: "HTTP" | "EVENT" | "EXTERNAL"; // RF-30.6 servicio que originó el registro
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: number | null;
  ip: string | null;
  reviewed: boolean;
  reviewedBy: string | null; // RF-30.9 quién y cuándo
  reviewedAt: string | null;
  createdAt: string;
}
// AuditReport / ComplianceReport => RF-30.7 dashboard de eventos y reporte de cumplimiento (GET /audit/report y /compliance)
export interface AuditReport {
  total: number;
  unreviewedCritical: number;
  byModule: Array<{ key: string; count: number }>;
  bySeverity: Array<{ key: string; count: number }>;
  topActors: Array<{ key: string; count: number }>;
  byDay: Array<{ key: string; count: number }>;
}
export interface ComplianceReport {
  score: number;
  controls: Array<{ id: string; title: string; passed: boolean; evidence: string }>;
  metrics: { critical: number; reviewedInSla: number; accessDenied: number; deletions: number; admins: number };
}
export interface McpTransaction {
  id: string;
  type: string;
  status: string;
  steps: Array<{ name: string; status: string; error: string | null }>;
  log: Array<{ at: string; message: string }>;
  createdAt: string;
}

// ---------- Hooks genéricos (Factory) ----------

// useToken => token del backend + bandera "lista para consultar" (sin sesión no se dispara ninguna petición)
function useToken() {
  const { accessToken } = useAuth();
  return { token: accessToken, enabled: Boolean(accessToken) };
}

// useAdminList => listado paginado de un recurso; "keepPreviousData" => sin parpadeo al cambiar de página/filtro
export function useAdminList<T>(resource: string, path: string, query: Query = {}, baseUrl?: string) {
  const { token, enabled } = useToken();
  return useQuery({
    queryKey: queryKeys.admin(resource, { path, ...query }),
    queryFn: async (): Promise<Page<T>> => {
      const page = await apiRequest<T[]>(path, { token, query, cache: "no-store", ...(baseUrl ? { baseUrl } : {}) });
      return { data: page.data, meta: toMeta(page.meta) };
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

// useAdminGet => un recurso (detalle, KPIs, reportes). "id" vacío => no consulta (detalle aún no elegido)
export function useAdminGet<T>(resource: string, path: string | null, query: Query = {}, options: { refetchInterval?: number | false; baseUrl?: string } = {}) {
  const { token, enabled } = useToken();
  return useQuery({
    queryKey: queryKeys.admin(resource, { path, ...query }),
    queryFn: async () => (await apiRequest<T>(path ?? "", { token, query, cache: "no-store", ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}) })).data,
    enabled: enabled && Boolean(path),
    refetchInterval: options.refetchInterval ?? false,
  });
}

// toMeta => Adapter: FastAPI responde "total_pages" (snake_case de Pydantic) y Express "totalPages"; la tabla usa uno solo
function toMeta(meta: (PaginationMeta & { total_pages?: number }) | undefined): PaginationMeta | undefined {
  return meta && { ...meta, totalPages: meta.totalPages ?? meta.total_pages ?? 1 };
}

// MutationRequest => cómo traducir la entrada del formulario a una petición HTTP
export type MutationRequest = { path: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown; baseUrl?: string };

// useAdminMutation => escritura + invalidación SOLO de los recursos afectados (las demás consultas siguen en caché)
export function useAdminMutation<Input, Output = unknown>(resources: string[], toRequest: (input: Input) => MutationRequest) {
  const { token } = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Input) => {
      const request = toRequest(input);
      return (await apiRequest<Output>(request.path, { method: request.method, body: request.body, token, ...(request.baseUrl ? { baseUrl: request.baseUrl } : {}) })).data;
    },
    onSuccess: () => Promise.all(resources.map((resource) => queryClient.invalidateQueries({ queryKey: ["admin", resource] }))),
  });
}

// ---------- Hooks específicos del panel principal ----------

// useKpis => portada del panel en UNA petición (KPIs, operación, serie y top); "realtime" salta la caché del backend
export function useKpis(range: { from: string; to?: string | undefined }, realtime: boolean) {
  return useAdminGet<KpiResponse>("kpi", "/dashboard/kpi", { from: range.from, to: range.to, realtime: realtime || undefined });
}

// useVendorKpis => portada del VENDEDOR en UNA petición (Express filtra por el vendedor del token)
export function useVendorKpis(range: { from: string; to?: string | undefined }) {
  return useAdminGet<VendorKpiResponse>("vendor-kpi", "/dashboard/vendor", { from: range.from, to: range.to });
}

// useAdminSocket => Observer genérico de Socket.io para el panel (DRY: métricas en vivo RF-24 y auditoría en vivo
// RF-30.8). Mientras "enabled" sea true se une a la sala "<channel>:subscribe" y entrega cada "event" a "onMessage".
// socket.io-client se descarga solo aquí (import dinámico) y usa WebSocket directo; al desactivar se cierra el socket.
export function useAdminSocket<T>(enabled: boolean, channel: string, event: string, onMessage: (payload: T) => void) {
  const { token } = useToken();
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage; // Último callback sin reabrir el socket en cada render

  useEffect(() => {
    if (!enabled || !token) return;
    let disconnect = () => undefined as void;
    let cancelled = false;
    void import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      const socket = io(config.socketUrl, { path: "/ws/socket.io", transports: ["websocket"], auth: { token } });
      socket.on("connect", () => socket.emit(`${channel}:subscribe`)); // También al reconectar
      socket.on(event, (payload: T) => handlerRef.current(payload));
      disconnect = () => {
        socket.emit(`${channel}:unsubscribe`);
        socket.disconnect();
      };
    });
    // Limpieza: al salir del panel o apagar "en vivo" se cierra el socket (cero conexiones ociosas)
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [enabled, token, channel, event]);
}

// useLiveMetrics => cada "analytics:tick" invalida los KPIs de la portada
export function useLiveMetrics(enabled: boolean, onTick?: (tick: { events: number; orders: number; revenueCents: number }) => void) {
  const queryClient = useQueryClient();
  useAdminSocket<{ events: number; orders: number; revenueCents: number }>(enabled, "analytics", "analytics:tick", (tick) => {
    onTick?.(tick);
    void queryClient.invalidateQueries({ queryKey: ["admin", "kpi"] });
  });
}

// uploadAuthed => RF-04.3 sube un archivo (multipart/form-data, campo "file") con el token y devuelve "data" del sobre JSON.
// "FormData" => el navegador arma el multipart y su boundary (no se fija Content-Type a mano)
export async function uploadAuthed<T>(path: string, file: File, token: string): Promise<T> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${config.apiUrl}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
  const json = (await response.json()) as { success: boolean; data?: T; message?: string };
  if (!response.ok || !json.success || json.data === undefined) throw new Error(json.message ?? "No se pudo subir el archivo");
  return json.data;
}

// downloadAuthed => descarga un archivo protegido (PDF de factura / guía) con el token, como blob
export async function downloadAuthed(path: string, filename: string, token: string): Promise<void> {
  const response = await fetch(`${config.apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No se pudo descargar el archivo");
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url); // Libera la memoria del blob
}
