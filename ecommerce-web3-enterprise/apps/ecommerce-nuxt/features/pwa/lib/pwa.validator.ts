// pwa.validator.ts (Zod) => valida la suscripción Web Push del navegador ANTES de enviarla a Express (endpoint HTTPS
// y llaves presentes) y las cachés que el panel permite borrar (lista blanca: nunca se borra la precarga del SW).
// También convierte la llave VAPID base64url al formato que pide PushManager (función pura).
import { z } from "zod";
import { CACHE_NAMES } from "~~/shared/constants/config";

export const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(40), auth: z.string().min(10) }),
});

// Solo cachés de tiempo de ejecución (las de Workbox precache se gestionan solas al actualizar la app)
export const clearableCache = z.enum([CACHE_NAMES.images, CACHE_NAMES.api, CACHE_NAMES.pages]);

// urlBase64ToUint8Array => llave pública VAPID (base64url) -> bytes para applicationServerKey
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
