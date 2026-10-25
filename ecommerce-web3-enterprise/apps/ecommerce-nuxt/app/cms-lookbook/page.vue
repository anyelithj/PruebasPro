<!--
  page.vue (/cms-lookbook) => galería pública de lookbooks publicados (SSR + ISR, petición ANÓNIMA) con carga
  incremental. El staff ve además el botón "Nuevo" y el enlace al panel (sin cambiar lo que se cachea).
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { useAuth } from "~~/shared/composable/useAuth";
import { useInfiniteList } from "~~/shared/composable/useInfiniteScroll";
import { cmsApi } from "~~/features/cms/api/cms.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { routes } from "~~/shared/constants/routes";
import type { CmsContentSummary } from "~~/entities/cms/model/cms.types";
import Button from "~~/shared/ui/Button.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { hasRole } = useAuth();
const api = cmsApi(useApi({ anonymous: true }));
const { data } = await useAsyncData(`lookbooks:${locale.value}`, () => api.list("lookbook", { locale: locale.value, page: 1, limit: 12 }));
const { items, sentinel, loading } = useInfiniteList<CmsContentSummary>((page) => api.list("lookbook", { locale: locale.value, page, limit: 12 }), data.value?.data ?? [], data.value?.meta?.totalPages ?? 1);
useSEOMeta(() => ({ title: t("lookbook.title"), description: t("lookbook.description"), path: routes.lookbooks }));
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">{{ $t("lookbook.title") }}</h1>
        <p class="mt-2 text-slate-600">{{ $t("lookbook.description") }}</p>
      </div>
      <!-- El staff crea lookbooks desde el listado único del CMS (mismo editor que páginas y landings) -->
      <ClientOnly><Button v-if="hasRole('ADMIN')" :to="localePath(`${routes.cmsPageNew}?kind=lookbook`)">{{ $t("common.new") }}</Button></ClientOnly>
    </header>
    <EmptyState v-if="!items.length" :title="$t('lookbook.empty')" />
    <ul v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" :aria-busy="loading || undefined">
      <li v-for="lookbook in items" :key="lookbook.id">
        <NuxtLink :to="localePath(routes.lookbook(lookbook.slug))" class="group block overflow-hidden rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <img v-if="lookbook.coverUrl" :src="lookbook.coverUrl" :alt="lookbook.coverAlt ?? ''" loading="lazy" width="600" height="750" class="aspect-[4/5] w-full object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transition-none" >
          <div class="p-4">
            <h2 class="text-lg font-semibold">{{ lookbook.title }}</h2>
            <p v-if="lookbook.data['season']" class="text-sm text-slate-500">{{ lookbook.data["season"] }}</p>
          </div>
        </NuxtLink>
      </li>
    </ul>
    <div ref="sentinel" class="h-1" aria-hidden="true" />
  </section>
</template>
