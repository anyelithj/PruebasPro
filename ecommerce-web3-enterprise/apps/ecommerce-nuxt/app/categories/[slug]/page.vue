<!--
  page.vue (/categories/[slug]) => página SEO de una categoría: migas de pan (JSON-LD), descripción, subcategorías y
  productos con enlace a la ficha de la tienda (SSR + ISR, petición ANÓNIMA). Paginación con enlaces ?page= (rastreable).
-->
<script setup lang="ts">
import { computed } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { seoApi } from "~~/features/seo/api/seo.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam, eventsQuerySchema } from "~~/features/seo/lib/seo.validator";
import CategoryBreadcrumb from "~~/features/seo/ui/CategoryBreadcrumb.vue";
import { routes } from "~~/shared/constants/routes";
import { formatMoney } from "~~/shared/lib/format";

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const page = computed(() => eventsQuerySchema.parse(route.query).page); // Mismo validador de ?page= (DRY)
const api = seoApi(useApi({ anonymous: true }));
const { data: category, error } = await useAsyncData(`category:${slug.data}`, () => api.category(slug.data));
if (error.value || !category.value) throw createError({ statusCode: 404, fatal: true });
const { data: products } = await useAsyncData(() => `category-products:${slug.data}:${page.value}`, () => api.categoryProducts(slug.data, page.value), { watch: [page] });
const { locale } = useI18n();
const localePath = useLocalePath();
useSEOMeta(() => ({ title: category.value?.name ?? "", description: category.value?.description, image: category.value?.imageUrl, path: routes.category(slug.data) }));
</script>

<template>
  <section v-if="category" class="flex flex-col gap-6">
    <CategoryBreadcrumb :category="category" />
    <header>
      <h1 class="text-3xl font-bold">{{ category.name }}</h1>
      <p v-if="category.description" class="mt-2 max-w-3xl text-slate-600">{{ category.description }}</p>
    </header>
    <nav v-if="category.children.length" :aria-label="$t('category.subcategories')">
      <ul class="flex flex-wrap gap-2">
        <li v-for="child in category.children" :key="child.id"><NuxtLink :to="localePath(routes.category(child.slug))" class="rounded-full border px-3 py-1 text-sm hover:bg-slate-50">{{ child.name }}</NuxtLink></li>
      </ul>
    </nav>
    <ul class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      <li v-for="product in products?.data ?? []" :key="product.id">
        <NuxtLink :to="localePath(routes.product(product.slug))" class="group block overflow-hidden rounded-lg border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.imageAlt ?? ''" loading="lazy" width="320" height="320" class="aspect-square w-full object-cover" >
          <div class="p-3">
            <h2 class="line-clamp-2 text-sm font-medium group-hover:underline">{{ product.name }}</h2>
            <p class="mt-1 text-sm tabular-nums">{{ formatMoney(product.minPriceCents, product.currency, locale) }}</p>
          </div>
        </NuxtLink>
      </li>
    </ul>
    <nav v-if="(products?.meta?.totalPages ?? 1) > 1" :aria-label="$t('common.pagination')" class="flex justify-between text-sm">
      <NuxtLink v-if="page > 1" :to="{ query: { page: page - 1 } }" rel="prev" class="underline">{{ $t("common.previous") }}</NuxtLink><span v-else />
      <NuxtLink v-if="page < (products?.meta?.totalPages ?? 1)" :to="{ query: { page: page + 1 } }" rel="next" class="underline">{{ $t("common.next") }}</NuxtLink>
    </nav>
  </section>
</template>
