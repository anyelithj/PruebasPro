<!--
  page.vue (/cms-collection) => colecciones vigentes del catálogo (Express /collection, PostgreSQL) en SSR + ISR con
  petición ANÓNIMA. El staff ve el acceso a crear. Patrón Composite (tarjeta por colección).
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { useAuth } from "~~/shared/composable/useAuth";
import { cmsApi } from "~~/features/cms/api/cms.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { routes } from "~~/shared/constants/routes";
import Button from "~~/shared/ui/Button.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";

const { t } = useI18n();
const localePath = useLocalePath();
const { hasRole } = useAuth();
const api = cmsApi(useApi({ anonymous: true }));
const { data } = await useAsyncData("collections", () => api.collections({ limit: 30 }));
useSEOMeta(() => ({ title: t("collection.title"), description: t("collection.description"), path: routes.collections }));
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">{{ $t("collection.title") }}</h1>
        <p class="mt-2 text-slate-600">{{ $t("collection.description") }}</p>
      </div>
      <ClientOnly><Button v-if="hasRole('ADMIN')" :to="localePath(routes.collectionNew)">{{ $t("common.new") }}</Button></ClientOnly>
    </header>
    <EmptyState v-if="!data?.data.length" :title="$t('collection.empty')" />
    <ul v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="collection in data.data" :key="collection.id">
        <NuxtLink :to="localePath(routes.collection(collection.slug))" class="group relative block overflow-hidden rounded-xl bg-brand text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <img v-if="collection.imageUrl" :src="collection.imageUrl" alt="" loading="lazy" width="640" height="400" class="aspect-[16/10] w-full object-cover opacity-80 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" >
          <div v-else class="aspect-[16/10] w-full" aria-hidden="true" />
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 p-4">
            <h2 class="text-lg font-semibold">{{ collection.name }}</h2>
            <p class="text-sm text-slate-200">{{ $t("cms.collection.products", { count: collection.productCount }) }}</p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
