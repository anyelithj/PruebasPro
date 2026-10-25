// outbox.ts (Service Worker + Workbox Background Sync) => RF-28.4 / RF-28.7 acciones hechas SIN conexión:
//   1. Una petición que modifica datos (carrito, reseña, contacto, UGC, compartir) falla por red => se guarda en una
//      cola persistente (IndexedDB) y se responde 202 { queued: true } para que la tienda siga funcionando.
//   2. Al volver la red el navegador dispara el evento "sync" (Background Sync API) y la cola se reenvía en orden;
//      sin soporte del navegador, Workbox la reenvía al reiniciar el SW y la página la pide con REPLAY_OUTBOX.
//   3. Cada petición lleva "Idempotency-Key" (api-client): si el servidor ya la procesó, responde lo mismo sin
//      duplicar (RF-28.7 reintentos seguros). Los pagos y el checkout NO se encolan (necesitan confirmación en línea).
// Patrones: Command (cada petición guardada es un comando diferido) + Observer (sync/online) + Proxy (fetch).
import { Queue } from "workbox-background-sync";
import { registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

// Rutas que se pueden diferir sin riesgo (el resto falla de inmediato para que el usuario lo sepa)
const QUEUEABLE = /\/api\/v1\/(cart|review|communication\/contact|social\/ugc|loyalty\/me\/share|notification\/preferences)(\/|$)/;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// notifyClients => avisa a las pestañas abiertas (OfflineIndicator muestra "N acciones pendientes" / "sincronizado")
async function notifyClients(message: Record<string, unknown>): Promise<void> {
  for (const client of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) client.postMessage(message);
}

const queue = new Queue("store-outbox", {
  maxRetentionTime: 24 * 60, // Minutos: una acción de hace más de un día ya no se envía (igual que la clave en Express)
  // onSync => reenvía en orden; si una falla por red, vuelve a la cola y se reintenta en el próximo "sync"
  onSync: async ({ queue: q }) => {
    let sent = 0;
    let entry = await q.shiftRequest();
    while (entry) {
      try {
        await fetch(entry.request.clone());
        sent += 1;
      } catch (error) {
        await q.unshiftRequest(entry); // Sin red todavía: se conserva para el próximo intento
        await notifyClients({ type: "OUTBOX_PENDING", count: (await q.getAll()).length });
        throw error; // Workbox reprograma el sync
      }
      entry = await q.shiftRequest();
    }
    if (sent) await notifyClients({ type: "OUTBOX_SYNCED", count: sent });
  },
});

// deferrable => manejador único (DRY): intenta en línea; sin red guarda en la cola y responde 202 { queued: true }
async function deferrable({ request }: { request: Request }): Promise<Response> {
  const backup = request.clone(); // El cuerpo solo se puede leer una vez: copia para la cola
  try {
    return await fetch(request);
  } catch {
    await queue.pushRequest({ request: backup });
    await notifyClients({ type: "OUTBOX_PENDING", count: (await queue.getAll()).length });
    // Mismo sobre de Express: la tienda muestra "se enviará al recuperar la conexión"
    return new Response(JSON.stringify({ success: true, data: null, queued: true }), { status: 202, headers: { "Content-Type": "application/json" } });
  }
}

export function registerOutbox(): void {
  // Workbox registra una ruta por método HTTP: el mismo manejador para cada verbo que modifica datos
  for (const method of MUTATING) {
    registerRoute(({ url, request }) => QUEUEABLE.test(url.pathname) && request.headers.has("Idempotency-Key"), deferrable, method as "POST" | "PUT" | "PATCH" | "DELETE");
  }
  // Respaldo para navegadores sin Background Sync (Safari/Firefox): la página pide reenviar al detectar "online"
  self.addEventListener("message", (event) => {
    if ((event.data as { type?: string } | null)?.type === "REPLAY_OUTBOX") event.waitUntil(queue.replayRequests().then(() => notifyClients({ type: "OUTBOX_SYNCED", count: 0 })).catch(() => undefined));
  });
}
