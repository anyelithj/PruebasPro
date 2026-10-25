<!--
  CategoryBreadcrumb.vue (Vue 3) => migas de pan visibles + JSON-LD BreadcrumbList. Recibe ítems genéricos (cualquier
  sección) o una categoría con su breadcrumb de Express (Adapter: jerarquía -> ítems). Es el ÚNICO renderer de migas
  (el widget BreadcrumbNav lo reutiliza: DRY). Accesibilidad: <nav aria-label>, <ol> y aria-current="page".
-->
<script setup lang="ts">
import { computed } from "vue";
import type { CategoryDetail } from "~~/entities/blog/model/blog.types";
import { routes } from "~~/shared/constants/routes";
import { breadcrumbJsonLd, type Crumb } from "../composable/useSEOMeta";

const props = defineProps<{ items?: Crumb[]; category?: CategoryDetail }>();
const { t } = useI18n();
const localePath = useLocalePath();
const { public: config } = useRuntimeConfig();

// crumbs => ítems explícitos o, con una categoría, "Categorías" + su breadcrumb de Express (raíz -> actual, incluida)
const crumbs = computed<Crumb[]>(() => props.items ?? [{ label: t("nav.categories"), to: routes.categories }, ...(props.category?.breadcrumb ?? []).map((item) => ({ label: item.name, to: routes.category(item.slug) }))]);

useHead(() => ({ script: [{ type: "application/ld+json", innerHTML: JSON.stringify(breadcrumbJsonLd(crumbs.value.map((crumb) => ({ label: crumb.label, ...(crumb.to ? { url: `${config.siteUrl}${localePath(crumb.to)}` } : {}) })))) }] }));
</script>

<template>
  <nav :aria-label="$t('nav.breadcrumb')" class="text-sm text-slate-600">
    <ol class="flex flex-wrap items-center gap-1">
      <li v-for="(crumb, index) in crumbs" :key="index" class="flex items-center gap-1">
        <NuxtLink v-if="crumb.to && index < crumbs.length - 1" :to="localePath(crumb.to)" class="hover:underline">{{ crumb.label }}</NuxtLink>
        <span v-else aria-current="page" class="font-medium text-slate-900">{{ crumb.label }}</span>
        <span v-if="index < crumbs.length - 1" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>
