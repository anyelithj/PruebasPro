<!--
  BreadcrumbNav.vue (widget) => migas de pan de cualquier sección. Delega en CategoryBreadcrumb (feature seo), que
  es el único renderer de migas + JSON-LD (DRY: una sola implementación accesible).
-->
<script setup lang="ts">
import CategoryBreadcrumb from "~~/features/seo/ui/CategoryBreadcrumb.vue";
import type { Crumb } from "~~/features/seo/composable/useSEOMeta";

defineProps<{ items: Crumb[] }>();
</script>

<template>
  <CategoryBreadcrumb :items="items" />
</template>
