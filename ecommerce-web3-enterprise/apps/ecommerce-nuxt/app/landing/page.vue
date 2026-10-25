<!--
  page.vue (/landing) => listado público de landings vigentes (SSR + ISR 1 h: se renderiza una vez y se sirve desde
  caché). Petición ANÓNIMA (la caché es compartida). Patrón Composite (LandingCard por landing).
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { landingApi } from "~~/features/landing/api/landing.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { routes } from "~~/shared/constants/routes";
import LandingCard from "~~/widgets/landing/LandingCard.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";

const { t, locale } = useI18n();
const api = landingApi(useApi({ anonymous: true }));
const { data } = await useAsyncData(`landings:${locale.value}`, () => api.list({ locale: locale.value, limit: 24 }));
useSEOMeta(() => ({ title: t("landing.listTitle"), description: t("landing.listDescription"), path: routes.landings }));
</script>

<template>
  <section class="flex flex-col gap-6">
    <header>
      <h1 class="text-3xl font-bold">{{ $t("landing.listTitle") }}</h1>
      <p class="mt-2 text-slate-600">{{ $t("landing.listDescription") }}</p>
    </header>
    <EmptyState v-if="!data?.data.length" :title="$t('landing.empty')" />
    <ul v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="landing in data.data" :key="landing.id"><LandingCard :landing="landing" /></li>
    </ul>
  </section>
</template>
