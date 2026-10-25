<!--
  InstallPrompt.vue (Vue 3 + @vite-pwa/nuxt) => invita a instalar la app cuando el navegador lo permite. Se muestra
  solo si está disponible y no se descartó en la sesión (sin insistir). Variante "card" para /pwa/install y
  "banner" para la barra inferior. Accesibilidad: región con nombre y botones con texto.
-->
<script setup lang="ts">
import Button from "~~/shared/ui/Button.vue";
import { usePWAInstall } from "../composable/usePWAInstall";

withDefaults(defineProps<{ variant?: "banner" | "card" }>(), { variant: "banner" });
const { state, install, dismiss } = usePWAInstall();
</script>

<template>
  <section v-if="variant === 'card'" class="flex flex-col gap-3 rounded-xl border bg-white p-6" aria-labelledby="install-title">
    <h2 id="install-title" class="text-lg font-semibold">{{ $t("pwa.install.title") }}</h2>
    <p class="text-sm text-slate-600">{{ $t(`pwa.install.${state}`) }}</p>
    <Button v-if="state === 'available'" @click="install">{{ $t("pwa.install.action") }}</Button>
  </section>
  <div v-else-if="state === 'available'" role="region" :aria-label="$t('pwa.install.title')" class="flex items-center justify-between gap-3 rounded-lg bg-brand px-4 py-3 text-sm text-white shadow-lg">
    <span>{{ $t("pwa.install.banner") }}</span>
    <div class="flex gap-2">
      <button type="button" class="rounded-md px-3 py-1.5 hover:bg-white/10" @click="dismiss">{{ $t("pwa.install.later") }}</button>
      <button type="button" class="rounded-md bg-white px-3 py-1.5 font-medium text-slate-900" @click="install">{{ $t("pwa.install.action") }}</button>
    </div>
  </div>
</template>
