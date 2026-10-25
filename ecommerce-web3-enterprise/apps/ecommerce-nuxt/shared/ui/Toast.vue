<!--
  Toast.vue (Vue 3) => muestra los avisos publicados con useToast (Observer). Región aria-live: el lector de pantalla
  anuncia cada aviso sin mover el foco (WCAG 4.1.3). Se monta una vez en app.vue.
-->
<script setup lang="ts">
import { useToast } from "../composable/useToast";

const { toasts, dismiss } = useToast();
// TONES => color del borde por tipo; el texto siempre acompaña al color (WCAG 1.4.1)
const TONES = { success: "border-l-green-600", error: "border-l-red-600", info: "border-l-accent" } as const;
</script>

<template>
  <div aria-live="polite" class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" :role="toast.tone === 'error' ? 'alert' : 'status'" :class="['pointer-events-auto flex items-start justify-between gap-3 rounded-md border border-l-4 bg-white p-3 text-sm shadow-lg', TONES[toast.tone]]">
        <p>{{ toast.message }}</p>
        <button type="button" class="rounded p-1 hover:bg-slate-100" :aria-label="$t('common.close')" @click="dismiss(toast.id)"><span aria-hidden="true">✕</span></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Transición CSS (GPU) en lugar de librerías de animación; se anula con "reducir movimiento" */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
