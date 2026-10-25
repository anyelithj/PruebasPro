<!--
  CMSBlockRenderer.vue (Vue 3) => dibuja en las páginas PÚBLICAS el HTML/CSS que guardó el editor GrapesJS.
  Se renderiza en el servidor (SSR/ISR: HTML listo para buscadores, 0 JavaScript de GrapesJS en la página pública).
  Seguridad: Express sanea el HTML al guardar (sin <script>, iframes ni atributos on*). El CSS se acota al
  contenedor (.cms-content) para que no altere el resto del sitio. Patrón Composite (bloques -> documento).
-->
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ html: string; css: string }>();

// scopeCss => prefija cada selector con .cms-content (función pura; las @media conservan su bloque interno)
function scopeCss(css: string): string {
  return css.replace(/(^|})\s*([^{}@]+)\s*{/g, (_match, close: string, selectors: string) => `${close} ${selectors.split(",").map((selector) => (selector.trim() === "body" || selector.trim() === "*" ? ".cms-content" : `.cms-content ${selector.trim()}`)).join(", ")} {`);
}

// useHead => el CSS va al <head> (una sola etiqueta <style> por página, deduplicada por "key")
useHead(() => ({ style: [{ key: "cms-content", innerHTML: scopeCss(props.css) }] }));
const html = computed(() => props.html);
</script>

<template>
  <!-- v-html => el HTML ya viene saneado por Express (solo administradores lo editan) -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="cms-content" v-html="html" />
</template>
