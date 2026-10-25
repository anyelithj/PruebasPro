<!--
  page.vue (/brands) => RF-05 índice SEO de marcas: las PREMIUM primero (Express ordena por isPremium) con su insignia y
  las exclusivas marcadas (RF-05.3). Cada tarjeta enlaza a su landing /brands/[slug]. SSR + ISR, petición ANÓNIMA.
  Accesibilidad: lista semántica, un solo enlace por tarjeta (patrón "card link") y texto en las insignias.
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { storeApi } from "~~/features/store/api/store.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import Badge from "~~/shared/ui/Badge.vue";
import { routes } from "~~/shared/constants/routes";

const api = storeApi(useApi({ anonymous: true }));
const { data: brands } = await useAsyncData("brands", () => api.brands());
const { t } = useI18n();
const localePath = useLocalePath();
useSEOMeta(() => ({ title: t("brand.title"), description: t("brand.description"), path: routes.brands }));
</script>

<template>
  <section class="flex flex-col gap-6">
    <header>
      <h1 class="text-3xl font-bold">{{ $t("brand.title") }}</h1>
      <p class="mt-2 text-slate-600">{{ $t("brand.description") }}</p>
    </header>
    <ul v-if="brands?.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <li v-for="brand in brands" :key="brand.id" class="relative flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-center hover:shadow-sm">
        <img v-if="brand.logoUrl" :src="brand.logoUrl" alt="" width="96" height="96" loading="lazy" class="size-24 object-contain" >
        <div v-else class="flex size-24 items-center justify-center rounded-full bg-slate-100 text-2xl font-semibold text-slate-500" aria-hidden="true">{{ brand.name.charAt(0) }}</div>
        <h2 class="font-medium">
          <NuxtLink :to="localePath(routes.brand(brand.slug))" class="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-accent">{{ brand.name }}</NuxtLink>
        </h2>
        <div class="flex flex-wrap justify-center gap-1">
          <Badge v-if="brand.isPremium" tone="info">{{ $t("brand.premium") }}</Badge>
          <Badge v-if="brand.isExclusive" tone="success">{{ $t("brand.exclusive") }}</Badge>
        </div>
        <p class="text-xs text-slate-500">{{ $t("brand.products", { count: brand.productCount }) }}</p>
      </li>
    </ul>
    <EmptyState v-else :title="$t('brand.emptyTitle')" :description="$t('brand.emptyText')" />
  </section>
</template>
