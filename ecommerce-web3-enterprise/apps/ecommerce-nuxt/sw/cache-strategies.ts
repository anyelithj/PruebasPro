// cache-strategies.ts (Workbox) => reglas de caché del Service Worker (patrón Strategy: una estrategia por tipo):
//   - Imágenes (Cloudinary y propias): CacheFirst 30 días, máx. 80 => no se vuelven a descargar (ahorro de datos).
//   - API pública de contenido (GET /cms, /category, /collection): NetworkFirst con 3 s => datos frescos y respaldo
//     sin conexión. NUNCA se cachean rutas privadas ni con token (Authorization).
//   - Páginas (navegación): NetworkFirst; si no hay red, la página offline precacheada.
// Expiración por cantidad y edad => la caché no crece sin límite en el dispositivo.
import { registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { matchPrecache } from "workbox-precaching";
import { CACHE_NAMES } from "../shared/constants/config";

declare const self: ServiceWorkerGlobalScope;

const PUBLIC_API = /\/api\/v1\/(cms\/(page|landing|lookbook|event)|category|collection)(\/|\?|$)/;
// Relativa al alcance del SW (/cms/): funciona con cualquier prefijo del microfrontend
const OFFLINE_URL = new URL("pwa/offline", self.registration.scope).pathname;

export function registerCacheStrategies(): void {
  registerRoute(
    ({ request, url }) => request.destination === "image" || url.hostname === "res.cloudinary.com",
    new CacheFirst({ cacheName: CACHE_NAMES.images, plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })] })
  );

  registerRoute(
    ({ request, url }) => request.method === "GET" && PUBLIC_API.test(url.pathname) && !request.headers.has("Authorization"),
    new NetworkFirst({ cacheName: CACHE_NAMES.api, networkTimeoutSeconds: 3, plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60, purgeOnQuotaError: true })] })
  );

  registerRoute(
    ({ request }) => request.mode === "navigate",
    new NetworkFirst({ cacheName: CACHE_NAMES.pages, networkTimeoutSeconds: 3, plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 })] })
  );

  // Sin red ni caché: las navegaciones caen en la página offline (precacheada en el build)
  setCatchHandler(async ({ request }) => {
    if (request.destination !== "document") return Response.error();
    return (await matchPrecache(OFFLINE_URL)) ?? (await matchPrecache(`${OFFLINE_URL}/index.html`)) ?? Response.error();
  });
}
