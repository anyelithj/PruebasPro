<!--
  UpdateBanner.vue (Vue 3 + @vite-pwa/nuxt) => aviso de nueva versión disponible. La app NUNCA se recarga sola
  (registerType "prompt"): el usuario decide cuándo, sin perder lo que estaba escribiendo. "Actualizar" activa el
  nuevo Service Worker (skipWaiting) y recarga. role="alert" para que se anuncie.
-->
<script setup lang="ts">
const { $pwa } = useNuxtApp();
</script>

<template>
  <div v-if="$pwa?.needRefresh" role="alert" class="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-slate-200">
    <span>{{ $t("pwa.update.available") }}</span>
    <div class="flex gap-2">
      <button type="button" class="rounded-md px-3 py-1.5 hover:bg-slate-100" @click="$pwa.cancelPrompt()">{{ $t("pwa.install.later") }}</button>
      <button type="button" class="rounded-md bg-brand px-3 py-1.5 font-medium text-white" @click="$pwa.updateServiceWorker(true)">{{ $t("pwa.update.action") }}</button>
    </div>
  </div>
</template>
