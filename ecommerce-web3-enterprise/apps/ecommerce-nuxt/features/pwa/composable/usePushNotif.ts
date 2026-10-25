// usePushNotif.ts (Composable + Push API + Service Worker) => activar/desactivar notificaciones push estándar (VAPID):
// pide permiso SOLO tras un clic del usuario (buena práctica y requisito de los navegadores), suscribe con la llave
// pública, valida la suscripción con Zod y la registra en Express. Desactivar borra la suscripción en ambos lados.
// Patrones: Facade (oculta PushManager) + Observer (estado en Pinia).
import { onMounted } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { pwaApi } from "../api/pwa.api";
import { subscriptionSchema, urlBase64ToUint8Array } from "../lib/pwa.validator";
import { usePwaStore } from "../model/pwa.store";

export function usePushNotif() {
  const store = usePwaStore();
  const api = pwaApi(useApi());
  const { public: config } = useRuntimeConfig();
  const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  // registration => el SW ya registrado por @vite-pwa (no se registra otro)
  const registration = () => navigator.serviceWorker.ready;

  onMounted(async () => {
    if (!supported()) return store.setPermission("unsupported");
    store.setPermission(Notification.permission);
    store.setPush(Boolean(await (await registration()).pushManager.getSubscription()));
  });

  async function enable(): Promise<boolean> {
    if (!supported() || !config.vapidPublicKey) return false;
    const permission = await Notification.requestPermission();
    store.setPermission(permission);
    if (permission !== "granted") return false;
    const subscription = await (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource });
    const json = subscriptionSchema.parse(subscription.toJSON()); // Lanza si el navegador devolvió algo inesperado
    await api.register(json);
    await api.setPush(true);
    store.setPush(true);
    return true;
  }

  async function disable(): Promise<void> {
    if (!supported()) return;
    const subscription = await (await registration()).pushManager.getSubscription();
    if (subscription) {
      await api.unregister(subscription.toJSON()).catch(() => undefined);
      await subscription.unsubscribe();
    }
    store.setPush(false);
  }

  return { enable, disable, supported };
}
