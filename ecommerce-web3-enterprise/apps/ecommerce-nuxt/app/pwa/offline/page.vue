<!--
  page.vue (/pwa/offline) => página que sirve el Service Worker cuando no hay conexión ni caché (prerenderizada en el
  build y precacheada). Sin datos remotos ni imágenes: funciona 100 % offline. Botón de reintento (recarga).
-->
<script setup lang="ts">
import Button from "~~/shared/ui/Button.vue";
definePageMeta({ layout: "blank" });
const { t } = useI18n();
useSeoMeta({ title: () => t("pwa.offline.title"), robots: "noindex" });
const retry = () => window.location.reload(); // Reintenta: si volvió la red, el SW sirve la página real
</script>

<template>
  <div class="flex flex-col gap-6">
    <p class="text-5xl" aria-hidden="true">📡</p>
    <h1 class="text-2xl font-semibold">{{ $t("pwa.offline.title") }}</h1>
    <p class="text-sm text-slate-600">{{ $t("pwa.offline.description") }}</p>
    <Button @click="retry">{{ $t("pwa.offline.retry") }}</Button>
  </div>
</template>
