// usePWAInstall.ts (Composable + @vite-pwa/nuxt) => instalación de la app: el módulo PWA ya captura el evento
// "beforeinstallprompt" ($pwa.showInstallPrompt) y expone install()/cancelInstall(); aquí se agrega el estado de UI
// (descartado en la sesión) y el estado "instalada". Patrón Facade + Observer (refs reactivas del módulo).
import { computed } from "vue";
import type { InstallState } from "~~/entities/pwa/model/pwa.types";
import { usePwaStore } from "../model/pwa.store";

export function usePWAInstall() {
  const { $pwa } = useNuxtApp();
  const store = usePwaStore();

  // state => Strategy de presentación según lo que soporta y hizo el navegador
  const state = computed<InstallState>(() => {
    if (!$pwa) return "unsupported";
    if ($pwa.isPWAInstalled) return "installed";
    if (store.installDismissed) return "dismissed";
    return $pwa.showInstallPrompt ? "available" : "unsupported";
  });

  const install = async () => {
    await $pwa?.install();
  };
  const dismiss = () => {
    store.dismissInstall();
    void $pwa?.cancelInstall();
  };

  return { state, install, dismiss };
}
