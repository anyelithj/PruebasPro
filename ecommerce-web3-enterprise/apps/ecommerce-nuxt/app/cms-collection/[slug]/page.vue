<!--
  page.vue (/cms-collection/[slug]) => colección pública: banner (CollectionBanner) y sus productos con enlace a la
  ficha de la tienda (SSR + ISR, petición ANÓNIMA). JSON-LD CollectionPage + migas de pan.
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { cmsApi } from "~~/features/cms/api/cms.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam } from "~~/features/seo/lib/seo.validator";
import CollectionBanner from "~~/features/cms/ui/CollectionBanner.vue";
import SchemaOrgMeta from "~~/features/seo/ui/SchemaOrgMeta.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import { routes } from "~~/shared/constants/routes";
import { formatMoney } from "~~/shared/lib/format";

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const api = cmsApi(useApi({ anonymous: true }));
const { data: collection, error } = await useAsyncData(`collection:${slug.data}`, () => api.collection(slug.data));
if (error.value || !collection.value) throw createError({ statusCode: 404, fatal: true });
const { locale } = useI18n();
const { public: config } = useRuntimeConfig();
const localePath = useLocalePath();
useSEOMeta(() => ({ title: collection.value?.name ?? "", description: collection.value?.description, image: collection.value?.imageUrl, path: routes.collection(slug.data) }));
</script>

<template>
  <article v-if="collection" class="flex flex-col gap-8">
    <SchemaOrgMeta type="CollectionPage" :data="{ title: collection.name, description: collection.description, url: `${config.siteUrl}/cms-collection/${collection.slug}` }" />
    <BreadcrumbNav :items="[{ label: $t('collection.title'), to: routes.collections }, { label: collection.name }]" />
    <CollectionBanner :collection="collection" />
    <ul class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      <li v-for="product in collection.products ?? []" :key="product.id">
        <NuxtLink :to="localePath(routes.product(product.slug))" class="group block overflow-hidden rounded-lg border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <img v-if="product.imageUrl" :src="product.imageUrl" alt="" loading="lazy" width="320" height="320" class="aspect-square w-full object-cover" >
          <div class="p-3">
            <h2 class="line-clamp-2 text-sm font-medium group-hover:underline">{{ product.name }}</h2>
            <p class="mt-1 text-sm tabular-nums text-slate-700">{{ formatMoney(product.minPriceCents, "COP", locale) }}</p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </article>
</template>
