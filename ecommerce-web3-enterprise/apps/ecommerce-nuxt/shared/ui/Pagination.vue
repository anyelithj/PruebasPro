<!--
  Pagination.vue => anterior / siguiente con "Página X de Y" (meta de Express). <nav> con nombre accesible y botones
  deshabilitados en los extremos. Emite "page" (Observer): el padre decide cómo cargar.
-->
<script setup lang="ts">
import type { PaginationMeta } from "../types/api.types";
import Button from "./Button.vue";

defineProps<{ meta: PaginationMeta | undefined }>();
const emit = defineEmits<{ page: [page: number] }>(); // Evento tipado (tupla con el número de página)
</script>

<template>
  <nav v-if="meta && meta.totalPages > 1" :aria-label="$t('common.pagination')" class="flex items-center justify-between gap-3 text-sm">
    <Button size="sm" variant="secondary" :disabled="meta.page <= 1" @click="emit('page', meta.page - 1)">{{ $t("common.previous") }}</Button>
    <span class="text-slate-600">{{ $t("common.page", { page: meta.page, total: meta.totalPages }) }}</span>
    <Button size="sm" variant="secondary" :disabled="meta.page >= meta.totalPages" @click="emit('page', meta.page + 1)">{{ $t("common.next") }}</Button>
  </nav>
</template>
