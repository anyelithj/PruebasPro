<!--
  page.vue (/products) => catálogo y búsqueda: ?q= (buscador del header), ?category=, ?collection=, ?brand=, ?badge=, ?sort=, ?page=.
  SSR con petición ANÓNIMA; filtros en la URL (compartibles y rastreables); el orden es un <form method="get">
  que funciona sin JavaScript.
-->
<script setup lang="ts">
import { computed } from "vue";
import { z } from "zod";
import { useApi } from "~~/shared/lib/api-client";
import { PRODUCT_SORTS, storeApi } from "~~/features/store/api/store.api";
import ProductGrid from "~~/features/product/ui/ProductGrid.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import { PRODUCT_BADGES } from "~~/entities/product/model/product.types";

// Validación de la query string (entrada del usuario): valores inválidos => valores por defecto
const querySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().max(100).optional().catch(undefined),
  collection: z.string().max(100).optional().catch(undefined),
  brand: z.string().max(100).optional().catch(undefined),
  badge: z.enum(PRODUCT_BADGES).optional().catch(undefined), // RF-04.2 ?badge=NEW|SALE|BEST_SELLER
  sort: z.enum(PRODUCT_SORTS).catch("newest"),
  page: z.coerce.number().int().min(1).catch(1),
});

const route = useRoute();
const { t } = useI18n();
const filters = computed(() => querySchema.parse(route.query));
const api = storeApi(useApi({ anonymous: true }));
const { data: result, pending } = await useAsyncData(() => `products:${JSON.stringify(filters.value)}`, () => api.products({ ...filters.value, q: filters.value.q || undefined, limit: 24 }), { watch: [filters] });
const totalPages = computed(() => result.value?.meta?.totalPages ?? 1);
const title = computed(() => (filters.value.q ? t("store.catalog.results", { q: filters.value.q }) : t("store.catalog.title")));
useSeoMeta({ title, robots: () => (filters.value.q ? "noindex, follow" : undefined) });
const pageLink = (page: number) => ({ query: { ...route.query, page } });
// RF-06.1 "¿Quisiste decir…?": solo cuando la búsqueda por texto no encontró nada (una petición liviana y cacheable)
const { data: spelling } = await useAsyncData(
  () => `spelling:${filters.value.q ?? ""}:${result.value?.meta?.total ?? -1}`,
  async () => (filters.value.q && filters.value.q.length >= 3 && result.value?.meta?.total === 0 ? (await api.spelling(filters.value.q)).data.suggestion : null),
  { watch: [result] }
);
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{{ title }}</h1>
        <p v-if="result?.meta" class="text-sm text-slate-600">{{ $t("store.catalog.count", { count: result.meta.total }) }}</p>
      </div>
      <form method="get" class="flex items-center gap-2 text-sm">
        <input v-if="filters.q" type="hidden" name="q" :value="filters.q" >
        <input v-if="filters.category" type="hidden" name="category" :value="filters.category" >
        <input v-if="filters.collection" type="hidden" name="collection" :value="filters.collection" >
        <input v-if="filters.brand" type="hidden" name="brand" :value="filters.brand" >
        <!-- RF-04.2 filtro por insignia (nuevos, ofertas, más vendidos) -->
        <label for="badge">{{ $t("store.catalog.badge") }}</label>
        <select id="badge" name="badge" :value="filters.badge ?? ''" class="h-9 rounded-md border border-slate-300 px-3 text-sm" @change="navigateTo({ query: { ...route.query, badge: ($event.target as HTMLSelectElement).value || undefined, page: 1 } })">
          <option value="">{{ $t("store.catalog.allBadges") }}</option>
          <option v-for="badge in PRODUCT_BADGES" :key="badge" :value="badge">{{ $t(`store.product.badges.${badge}`) }}</option>
        </select>
        <label for="sort">{{ $t("store.catalog.sort") }}</label>
        <select id="sort" name="sort" :value="filters.sort" class="h-9 rounded-md border border-slate-300 px-3 text-sm" @change="navigateTo({ query: { ...route.query, sort: ($event.target as HTMLSelectElement).value, page: 1 } })">
          <option v-for="sort in PRODUCT_SORTS" :key="sort" :value="sort">{{ $t(`store.catalog.sorts.${sort}`) }}</option>
        </select>
        <noscript><button type="submit" class="rounded-md border px-3 py-2">{{ $t("store.catalog.apply") }}</button></noscript>
      </form>
    </header>
    <p v-if="pending" class="text-sm text-slate-500">{{ $t("common.loading") }}</p>
    <ProductGrid v-else-if="result?.data.length" :products="result.data" :priority-count="4" />
    <template v-else>
      <p v-if="spelling" class="text-sm">
        {{ $t("store.catalog.didYouMean") }}
        <NuxtLink :to="{ query: { ...route.query, q: spelling, page: 1 } }" class="font-semibold underline">{{ spelling }}</NuxtLink>?
      </p>
      <EmptyState :title="$t('store.catalog.emptyTitle')" :description="$t('store.catalog.emptyText')" />
    </template>
    <nav v-if="totalPages > 1" :aria-label="$t('common.pagination')" class="flex items-center justify-between text-sm">
      <NuxtLink v-if="filters.page > 1" :to="pageLink(filters.page - 1)" rel="prev" class="underline">{{ $t("common.previous") }}</NuxtLink><span v-else />
      <span>{{ $t("common.page", { page: filters.page, total: totalPages }) }}</span>
      <NuxtLink v-if="filters.page < totalPages" :to="pageLink(filters.page + 1)" rel="next" class="underline">{{ $t("common.next") }}</NuxtLink><span v-else />
    </nav>
  </section>
</template>
