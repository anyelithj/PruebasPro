// useDebounce.ts (VueUse) => valor que solo cambia cuando el usuario deja de escribir (búsquedas, autoguardado).
// Menos peticiones al backend = menos red y energía. Patrón Observer (ref derivado).
import type { Ref } from "vue";
import { refDebounced } from "@vueuse/core";

export function useDebounce<T>(source: Ref<T>, delay = 400): Readonly<Ref<T>> {
  return refDebounced(source, delay);
}
