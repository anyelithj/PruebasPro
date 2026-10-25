// attribution.ts (Nuxt useCookie) => RF-09.7 canal de origen de la compra. Al entrar a la tienda desde una publicación
// social o una campaña (?utm_source=instagram, ?utm_medium=email, ?ref=social:post-123) se guarda 30 días en una cookie
// (modelo "último clic"); el carrito lo envía al checkout y el pedido queda con su canal (reportes de Social Commerce).
// Paradigma funcional: classify es una función pura (testeable); captureAttribution solo escribe si hay parámetros.
import { useCookie } from "#imports";
import type { LocationQuery } from "vue-router";

export interface Attribution {
  channel: "SOCIAL" | "MARKETING";
  ref: string;
}

const SOCIAL_SOURCES = new Set(["facebook", "instagram", "tiktok", "whatsapp", "twitter", "x", "pinterest", "youtube", "social"]);
const MARKETING_MEDIUMS = new Set(["email", "newsletter", "cpc", "ppc", "paid", "ads", "display", "sms", "affiliate"]);
const text = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase().slice(0, 60) : "");

// classify => canal según los parámetros de la URL (null = visita directa/orgánica: no cambia la atribución)
export function classify(query: LocationQuery): Attribution | null {
  const source = text(query.utm_source);
  const medium = text(query.utm_medium);
  const ref = text(query.ref);
  const campaign = text(query.utm_campaign);
  if (ref.startsWith("social") || SOCIAL_SOURCES.has(source) || medium === "social") return { channel: "SOCIAL", ref: ref || [source, campaign].filter(Boolean).join(":") };
  if (MARKETING_MEDIUMS.has(medium) || campaign) return { channel: "MARKETING", ref: [source, medium, campaign].filter(Boolean).join(":") };
  return null;
}

export function useAttribution() {
  // maxAge en segundos (30 días); sameSite=lax: viaja al volver desde redes sociales
  return useCookie<Attribution | null>("store_attribution", { maxAge: 30 * 24 * 60 * 60, sameSite: "lax", default: () => null });
}

// captureAttribution => se llama al cargar cualquier página de la tienda (StoreHeader)
export function captureAttribution(query: LocationQuery): void {
  const found = classify(query);
  if (found) useAttribution().value = found;
}
