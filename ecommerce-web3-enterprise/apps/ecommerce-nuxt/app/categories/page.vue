<!--
  page.vue (/categories) => índice SEO de categorías del catálogo en árbol (SSR + ISR, petición ANÓNIMA): enlazado
  interno hacia cada categoría (mejora el rastreo). Lista anidada semántica (<ul> dentro de <ul>).
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { seoApi } from "~~/features/seo/api/seo.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { routes } from "~~/shared/constants/routes";

const { t } = useI18n();
const localePath = useLocalePath();
const api = seoApi(useApi({ anonymous: true }));
const { data: tree } = await useAsyncData("categories", () => api.categories());
useSEOMeta(() => ({ title: t("category.title"), description: t("category.description"), path: routes.categories }));
</script>

<template>
  <section class="flex flex-col gap-6">
    <header>
      <h1 class="text-3xl font-bold">{{ $t("category.title") }}</h1>
      <p class="mt-2 text-slate-600">{{ $t("category.description") }}</p>
    </header>
    <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="category in tree ?? []" :key="category.id" class="rounded-xl border bg-white p-4">
        <NuxtLink :to="localePath(routes.category(category.slug))" class="flex items-center gap-3 font-semibold hover:underline">
          <img v-if="category.imageUrl" :src="category.imageUrl" alt="" width="48" height="48" loading="lazy" class="size-12 rounded-md object-cover" >
          {{ category.name }} <span class="text-sm font-normal text-slate-500">({{ category.productCount }})</span>
        </NuxtLink>
        <ul v-if="category.children.length" class="mt-3 flex flex-col gap-1 border-l pl-4 text-sm">
          <li v-for="child in category.children" :key="child.id">
            <NuxtLink :to="localePath(routes.category(child.slug))" class="text-slate-700 hover:underline">{{ child.name }}</NuxtLink>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
