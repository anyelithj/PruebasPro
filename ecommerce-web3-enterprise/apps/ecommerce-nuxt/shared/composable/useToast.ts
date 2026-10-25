// useToast.ts (Composable + useState de Nuxt) => avisos efímeros (éxito/error/info). Patrón Observer: cualquier
// componente publica con toast.success(...) y shared/ui/Toast.vue los muestra (región aria-live accesible).
// "useState" => estado global SSR-safe (una lista por petición en el servidor, una por pestaña en el navegador).
import { useState } from "#imports";

export type ToastTone = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const DURATION_MS = 4000;
let nextId = 0; // Contador del módulo: ids únicos sin librerías

export function useToast() {
  const toasts = useState<ToastItem[]>("toasts", () => []);

  const dismiss = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  };

  // push => agrega y programa su cierre (máximo 3 visibles: no se tapa la pantalla)
  const push = (tone: ToastTone, message: string) => {
    const id = ++nextId;
    toasts.value = [...toasts.value.slice(-2), { id, tone, message }];
    if (import.meta.client) setTimeout(() => dismiss(id), DURATION_MS);
  };

  return {
    toasts,
    dismiss,
    success: (message: string) => push("success", message),
    error: (message: string) => push("error", message),
    info: (message: string) => push("info", message),
  };
}
