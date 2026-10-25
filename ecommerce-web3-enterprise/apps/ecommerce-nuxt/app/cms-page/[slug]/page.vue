<!--
  page.vue (/cms-page/[slug]) => página estática pública creada con el editor (SSR + ISR 1 h; petición ANÓNIMA).
  El HTML de GrapesJS se dibuja en el servidor (CMSBlockRenderer): 0 JavaScript del editor en la página pública.
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { cmsApi } from "~~/features/cms/api/cms.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam } from "~~/features/seo/lib/seo.validator";
import CMSBlockRenderer from "~~/features/cms/ui/CMSBlockRenderer.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import { routes } from "~~/shared/constants/routes";

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const api = cmsApi(useApi({ anonymous: true }));
const { data: page, error } = await useAsyncData(`cms-page:${slug.data}`, () => api.get("page", slug.data));
if (error.value || !page.value) throw createError({ statusCode: 404, fatal: true });

useSEOMeta(() => ({ title: page.value?.seo.title || page.value?.title || "", description: page.value?.seo.description || page.value?.summary, image: page.value?.seo.imageUrl, path: routes.cmsPage(slug.data) }));
</script>

<template>
  <article v-if="page" class="flex flex-col gap-6">
    <BreadcrumbNav :items="[{ label: $t('nav.home'), to: routes.home }, { label: page.title }]" />
    <h1 class="text-3xl font-bold">{{ page.title }}</h1>
    <CMSBlockRenderer :html="page.body.html" :css="page.body.css" />
  </article>
</template>
