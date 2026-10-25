<!--
  page.vue (/cms-lookbook/[slug]) => lookbook público: introducción (GrapesJS en SSR) + galería masonry con productos
  etiquetados que llevan a la tienda (SSR + ISR, petición ANÓNIMA). JSON-LD CollectionPage + migas de pan.
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { cmsApi } from "~~/features/cms/api/cms.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam } from "~~/features/seo/lib/seo.validator";
import CMSBlockRenderer from "~~/features/cms/ui/CMSBlockRenderer.vue";
import LookbookGrid from "~~/features/cms/ui/LookbookGrid.vue";
import SchemaOrgMeta from "~~/features/seo/ui/SchemaOrgMeta.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import { routes } from "~~/shared/constants/routes";

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const api = cmsApi(useApi({ anonymous: true }));
const { data: lookbook, error } = await useAsyncData(`lookbook:${slug.data}`, () => api.get("lookbook", slug.data));
if (error.value || !lookbook.value) throw createError({ statusCode: 404, fatal: true });
const { public: config } = useRuntimeConfig();
useSEOMeta(() => ({ title: lookbook.value?.seo.title || lookbook.value?.title || "", description: lookbook.value?.seo.description || lookbook.value?.summary, image: lookbook.value?.media[0]?.url, path: routes.lookbook(slug.data) }));
</script>

<template>
  <article v-if="lookbook" class="flex flex-col gap-6">
    <SchemaOrgMeta type="CollectionPage" :data="{ title: lookbook.title, description: lookbook.summary, url: `${config.siteUrl}/cms-lookbook/${lookbook.slug}` }" />
    <BreadcrumbNav :items="[{ label: $t('lookbook.title'), to: routes.lookbooks }, { label: lookbook.title }]" />
    <header>
      <h1 class="text-3xl font-bold">{{ lookbook.title }}</h1>
      <p v-if="lookbook.summary" class="mt-2 max-w-2xl text-slate-600">{{ lookbook.summary }}</p>
    </header>
    <CMSBlockRenderer v-if="lookbook.body.html" :html="lookbook.body.html" :css="lookbook.body.css" />
    <LookbookGrid :media="lookbook.media" />
  </article>
</template>
