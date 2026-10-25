<!--
  error.vue (Nuxt) => página de error global (404, 500...). Responde con el status real (SEO: un 404 no se indexa) y
  ofrece volver al inicio con clearError (limpia el estado de error sin recargar la página).
-->
<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const { t } = useI18n();
const notFound = computed(() => props.error.statusCode === 404);
useSeoMeta({ title: () => (notFound.value ? t("error.notFound") : t("error.generic")), robots: "noindex" });
</script>

<template>
  <main id="main-content" class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
    <p class="text-6xl font-bold text-slate-300" aria-hidden="true">{{ error.statusCode }}</p>
    <h1 class="text-2xl font-semibold">{{ notFound ? $t("error.notFound") : $t("error.generic") }}</h1>
    <p class="text-sm text-slate-600">{{ notFound ? $t("error.notFoundHint") : $t("error.genericHint") }}</p>
    <button type="button" class="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" @click="clearError({ redirect: '/landing' })">
      {{ $t("error.home") }}
    </button>
  </main>
</template>
