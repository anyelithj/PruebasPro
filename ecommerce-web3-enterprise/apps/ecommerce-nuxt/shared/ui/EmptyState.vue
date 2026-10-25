<!--
  EmptyState.vue => estado vacío con título, descripción y acción opcional (slot). Evita pantallas en blanco (UX).
-->
<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
    <h2 class="text-base font-semibold text-slate-900">{{ title }}</h2>
    <p v-if="description" class="max-w-md text-sm text-slate-600">{{ description }}</p>
    <slot />
  </section>
</template>
