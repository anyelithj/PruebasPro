// push-handler.ts (Service Worker + Push API) => muestra las notificaciones push que envía Express (Web Push VAPID,
// mensaje cifrado aes128gcm que el navegador descifra) y abre/enfoca la pestaña correcta al tocar la notificación.
// Patrón Observer (eventos "push" y "notificationclick" del SW).
declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export function registerPushHandler(): void {
  self.addEventListener("push", (event) => {
    const fallback: PushPayload = { title: "eCommerce Web3", body: "" };
    let payload = fallback;
    try {
      payload = { ...fallback, ...(event.data?.json() as Partial<PushPayload>) };
    } catch {
      payload = { ...fallback, body: event.data?.text() ?? "" };
    }
    // waitUntil => el SW sigue vivo hasta mostrar la notificación
    event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: "/favicon.ico", badge: "/favicon.ico", data: { url: payload.url ?? "/" } }));
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL((event.notification.data as { url?: string })?.url ?? "/", self.location.origin).href;
    event.waitUntil(
      (async () => {
        // Reutiliza una pestaña ya abierta del sitio (no abre duplicadas)
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const existing = windows.find((client) => client.url.startsWith(self.location.origin));
        if (existing) {
          await existing.focus();
          return void (await existing.navigate(url));
        }
        await self.clients.openWindow(url);
      })()
    );
  });
}
