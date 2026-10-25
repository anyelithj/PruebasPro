<!--
  TopLoader.vue (widget · Vue 3 + Tailwind) => barra de progreso superior, ESPEJO de TopLoader.tsx (Next.js): mismo color,
  alto y tiempos. Dentro de Nuxt usa los hooks del router (page:loading:start / page:loading:end de nuxtApp); para
  enlaces que van a Next.js (otra app) arranca con el clic y avanza hasta que el navegador cambia de página.
  Patrones: Observer (hooks de Nuxt + listener de clics), State (idle → start → loading → done).
  Accesibilidad: role="progressbar" con nombre; aria-busy mientras carga.
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps<{ label: string }>();
type Phase = "idle" | "start" | "loading" | "done";
const phase = ref<Phase>("idle");
const nuxtApp = useNuxtApp(); // Instancia de la app: expone los hooks de carga de página

const start = () => {
  phase.value = "start";
  // 2 frames: el navegador pinta el 0 % antes de animar hacia el 85 %
  requestAnimationFrame(() => requestAnimationFrame(() => phase.value === "start" && (phase.value = "loading")));
};
const finish = () => {
  if (phase.value === "idle") return;
  phase.value = "done";
  setTimeout(() => phase.value === "done" && (phase.value = "idle"), 400);
};
// onClick => enlace que sale de esta app (a Next.js) o cambia de ruta: misma regla que en Next
const onClick = (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest("a");
  if (!anchor?.href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
  const url = new URL(anchor.href, window.location.href);
  if (url.pathname !== window.location.pathname || url.origin !== window.location.origin) start();
};
// Hooks del router de Nuxt (navegación SPA interna); "hook" devuelve la función para quitar el listener
const offStart = nuxtApp.hook("page:loading:start", start);
const offEnd = nuxtApp.hook("page:loading:end", finish);
onMounted(() => document.addEventListener("click", onClick, true));
onBeforeUnmount(() => {
  document.removeEventListener("click", onClick, true);
  offStart();
  offEnd();
});
</script>

<template>
  <div v-if="phase !== 'idle'" role="progressbar" :aria-label="label" :aria-busy="phase !== 'done'" class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
    <div
      class="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_0_8px_theme(colors.indigo.500)]"
      :style="phase === 'start' ? { width: '0%' } : phase === 'loading' ? { width: '85%', transition: 'width 8s cubic-bezier(.1,.6,.2,1)' } : { width: '100%', opacity: 0, transition: 'width .2s ease, opacity .3s ease .15s' }"
    />
  </div>
</template>
