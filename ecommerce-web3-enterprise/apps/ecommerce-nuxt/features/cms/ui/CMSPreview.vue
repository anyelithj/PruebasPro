<!--
  CMSPreview.vue (Vue 3) => vista previa en vivo del HTML/CSS del editor dentro de un <iframe sandbox> con "srcdoc":
  el contenido se aísla del panel (sin scripts ni acceso a cookies: seguridad) y se ve al ancho del dispositivo
  elegido (escritorio/tablet/móvil). Patrón Observer: se redibuja al cambiar "html", "css" o el dispositivo.
-->
<script setup lang="ts">
import { computed } from "vue";
import { DEVICE_WIDTH, useCmsStore } from "../model/cms.store";

const props = defineProps<{ html: string; css: string; title: string }>();
const store = useCmsStore();
// srcdoc => documento completo y autocontenido (sin peticiones de red adicionales)
const doc = computed(() => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,sans-serif}${props.css}</style></head><body>${props.html}</body></html>`);
</script>

<template>
  <div class="flex justify-center rounded-lg bg-slate-200 p-3">
    <!-- sandbox="" => sin scripts, formularios ni navegación del contenido previsualizado -->
    <iframe :srcdoc="doc" sandbox="" :title="title" class="h-[70vh] rounded bg-white shadow transition-[width] motion-reduce:transition-none" :style="{ width: DEVICE_WIDTH[store.device] }" />
  </div>
</template>
