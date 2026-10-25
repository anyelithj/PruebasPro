// useCountdown.ts (VueUse) => tiempo restante hasta una fecha (ofertas de landing y eventos). Un tic por segundo SOLO
// mientras la pestaña está visible y el plazo no terminó (useIntervalFn se pausa: cero trabajo en segundo plano).
// Patrón Observer + función pura de cálculo (split).
import { computed, ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { useDocumentVisibility, useIntervalFn } from "@vueuse/core";

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

// split => milisegundos -> días/horas/minutos/segundos (función pura, testeable)
export function split(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86_400), hours: Math.floor((total % 86_400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60, done: total === 0 };
}

// "intervalMs" => 1000 para el contador grande; 60_000 para el compacto (60 veces menos repintados)
export function useCountdown(target: MaybeRefOrGetter<string | Date | null | undefined>, intervalMs = 1000) {
  const now = ref(Date.now());
  const visibility = useDocumentVisibility();
  const { pause, resume } = useIntervalFn(() => (now.value = Date.now()), intervalMs, { immediate: false });
  const remaining = computed(() => {
    const value = toValue(target);
    return split(value ? new Date(value).getTime() - now.value : 0);
  });

  // Solo corre en el navegador, con la pestaña visible y mientras falte tiempo
  if (import.meta.client) {
    watch(
      [visibility, () => remaining.value.done],
      ([state, done]) => {
        now.value = Date.now();
        if (state === "visible" && !done) resume();
        else pause();
      },
      { immediate: true }
    );
  }
  return remaining;
}
