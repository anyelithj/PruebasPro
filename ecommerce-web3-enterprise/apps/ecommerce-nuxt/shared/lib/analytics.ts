// analytics.ts => eventos de analítica en dos destinos: window.dataLayer (Google Tag Manager; no-op si no existe) y la
// analítica propia de Express (POST /api/v1/analytic/event). Patrón Observer + Buffer: los eventos se acumulan y
// viajan en LOTES de hasta 50 (menos peticiones = menos energía). Respeta "No rastrear" (DNT) y Global Privacy Control.
export type AnalyticsEvent = "page_view" | "click" | "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "search" | "web_vital"; // web_vital => RF-24.8

// "declare global" => amplía window/navigator con tipos (sin "any")
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

interface EventData {
  productId?: string;
  value?: number; // Centavos
  channel?: string; // utm_source o red social de origen
  referrer?: string;
  metadata?: Record<string, unknown>;
}

const MAX_BATCH = 50; // Igual que MAX_BATCH de Express
const queue: Array<EventData & { type: AnalyticsEvent; path: string }> = []; // Buffer en memoria (por pestaña)
const optedOut = () => navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;

// sessionId => id anónimo por pestaña (sessionStorage: se borra al cerrarla; sin cookies de rastreo)
function sessionId(): string {
  try {
    const saved = sessionStorage.getItem("nuxt-analytics-session");
    if (saved) return saved;
    const created = crypto.randomUUID(); // Web Crypto nativa
    sessionStorage.setItem("nuxt-analytics-session", created);
    return created;
  } catch {
    return "anonymous-session";
  }
}

// track => publica un evento (GTM + buffer). Las claves vacías no se envían (contrato estricto del backend)
export function track(type: AnalyticsEvent, data: EventData = {}): void {
  if (typeof window === "undefined") return; // En SSR no hay navegador
  window.dataLayer?.push({ event: type, ...data });
  if (optedOut() || queue.length >= MAX_BATCH * 2) return; // Tope: el buffer nunca crece sin límite
  const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== "")) as EventData;
  queue.push({ ...clean, metadata: clean.metadata ?? {}, type, path: window.location.pathname.slice(0, 300) });
}

// flush => envía un lote con "keepalive" (sobrevive al cierre de la pestaña). Los fallos de red se ignoran:
// la analítica nunca rompe la experiencia.
export function flush(apiUrl: string, token?: string | null): void {
  if (queue.length === 0) return;
  const session = sessionId();
  const events = queue.splice(0, MAX_BATCH).map((event) => ({ ...event, sessionId: session })); // "splice" vacía el lote
  void fetch(`${apiUrl}/analytic/event`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ events }),
  }).catch(() => undefined);
}
