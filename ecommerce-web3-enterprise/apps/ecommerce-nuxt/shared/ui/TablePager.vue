<!--
  TablePager.vue => cantidad de registros y Anterior/Siguiente de una tabla del panel (espejo de TablePager de Next.js).
  Los botones solo aparecen con más de una página. Emite "page" (Observer): el padre decide cómo cargar.
-->
<script setup lang="ts">
import type { PaginationMeta } from "../types/api.types";
import Button from "./Button.vue";

defineProps<{ meta: PaginationMeta | undefined }>();
defineEmits<{ page: [page: number] }>();
</script>

<template>
  <nav v-if="meta && meta.total > 0" :aria-label="$t('common.pagination')" :class="['flex items-center gap-2 text-sm', meta.totalPages > 1 ? 'justify-between' : 'justify-end']">
    <Button v-if="meta.totalPages > 1" size="sm" variant="secondary" :disabled="meta.page <= 1" @click="$emit('page', meta.page - 1)">{{ $t("common.previous") }}</Button>
    <span class="text-center text-slate-600">{{ $t("common.pageCount", { page: meta.page, total: meta.totalPages, count: meta.total }) }}</span>
    <Button v-if="meta.totalPages > 1" size="sm" variant="secondary" :disabled="meta.page >= meta.totalPages" @click="$emit('page', meta.page + 1)">{{ $t("common.next") }}</Button>
  </nav>
</template>
