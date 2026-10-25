<!--
  page.vue (/landing/[slug]) => landing promocional (layout "landing" a pantalla completa, SSR + ISR). Slug validado
  con Zod antes de consultar (404 temprano). Middleware "analytics" guarda el utm de la campaña para el lead.
  SEO: title/description/OG propios del documento + JSON-LD de la organización.
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { landingApi } from "~~/features/landing/api/landing.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam } from "~~/features/seo/lib/seo.validator";
import SchemaOrgMeta from "~~/features/seo/ui/SchemaOrgMeta.vue";
import LandingHero from "~~/widgets/landing/LandingHero.vue";
import { routes } from "~~/shared/constants/routes";

definePageMeta({ layout: "landing", middleware: ["analytics"] });

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const api = landingApi(useApi({ anonymous: true }));
const { data: landing, error } = await useAsyncData(`landing:${slug.data}`, () => api.get(slug.data));
if (error.value || !landing.value) throw createError({ statusCode: 404, fatal: true });

useSEOMeta(() => ({
  title: landing.value?.seo.title || landing.value?.title || "",
  description: landing.value?.seo.description || landing.value?.summary,
  image: landing.value?.seo.imageUrl,
  path: routes.landing(slug.data),
}));
</script>

<template>
  <div v-if="landing">
    <SchemaOrgMeta type="Organization" :data="{}" />
    <LandingHero :landing="landing" />
  </div>
</template>
