// sw.ts (Service Worker + Workbox, estrategia injectManifest de @vite-pwa/nuxt) => punto de entrada del SW:
//   1. Precarga los assets del build (self.__WB_MANIFEST lo inyecta el build) y borra precargas viejas.
//   2. Registra las estrategias de caché en tiempo de ejecución (cache-strategies.ts) y el manejo de push.
//   3. Se activa solo cuando el usuario acepta la actualización (mensaje SKIP_WAITING desde UpdateBanner).
// Ahorro: los assets versionados se descargan UNA vez; las visitas siguientes salen del dispositivo.
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerCacheStrategies } from "./cache-strategies";
import { registerPushHandler } from "./push-handler";
import { registerOutbox } from "./outbox"; // RF-28.4 / RF-28.7 cola sin conexión con Background Sync

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerCacheStrategies();
registerPushHandler();
registerOutbox();

// Actualización controlada por el usuario (registerType "prompt")
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "SKIP_WAITING") void self.skipWaiting();
});
clientsClaim();
