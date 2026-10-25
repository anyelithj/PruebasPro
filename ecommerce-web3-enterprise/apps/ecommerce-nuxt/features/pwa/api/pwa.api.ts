// pwa.api.ts => Repository de la PWA contra Express (/notification): registrar y borrar la suscripción Web Push
// (se guarda como token "web" en el mismo registro que FCM) y leer/cambiar la preferencia de notificaciones push.
// Inyección del cliente "api".
import type { Api } from "~~/shared/lib/api-client";

export interface PushPreferences {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

export function pwaApi(api: Api) {
  return {
    register: (subscription: PushSubscriptionJSON) => api.post("/notification/push-token", { token: JSON.stringify(subscription), platform: "web" }),
    unregister: (subscription: PushSubscriptionJSON) => api.del("/notification/push-token", { token: JSON.stringify(subscription) }),
    preferences: async () => (await api.get<PushPreferences>("/notification/preferences")).data,
    setPush: (push: boolean) => api.patch("/notification/preferences", { push }),
  };
}
