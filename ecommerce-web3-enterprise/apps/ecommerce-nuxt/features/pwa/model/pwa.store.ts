// pwa.store.ts (Pinia, setup store) => Client State de la PWA: aviso de instalación descartado (no se insiste en la
// sesión), estado de la suscripción push y permiso de notificaciones. Patrones: Observer + Singleton.
import { defineStore } from "pinia";
import { ref } from "vue";

export const usePwaStore = defineStore("pwa", () => {
  const installDismissed = ref(false);
  const pushEnabled = ref(false);
  const permission = ref<NotificationPermission | "unsupported">("default");

  const dismissInstall = () => (installDismissed.value = true);
  const setPush = (value: boolean) => (pushEnabled.value = value);
  const setPermission = (value: NotificationPermission | "unsupported") => (permission.value = value);

  return { installDismissed, pushEnabled, permission, dismissInstall, setPush, setPermission };
});
