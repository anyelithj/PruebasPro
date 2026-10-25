<!--
  DataTable.vue (Vue 3, componente genérico) => tabla de datos del panel: columnas declarativas, celdas
  personalizables por slot ("cell-<clave>"), estados de carga/vacío. Patrones: Composite (columnas como datos) +
  Template Method (estructura fija, celdas variables). "generic" => tipado de la fila (Vue 3.3+).
  Accesibilidad: <table> semántica, <caption>, <th scope="col">, aria-busy; responsive con scroll horizontal propio.
-->
<script setup lang="ts" generic="T">
import { computed, ref } from "vue";
import Skeleton from "./Skeleton.vue";
import Button from "./Button.vue";
import type { Column } from "../types/common.types";

const props = defineProps<{
  caption: string;
  columns: Column[];
  rows: T[] | null | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: string;
}>();

// Más de 10 filas => paginación en el navegador (máximo 10 por vista, igual que las tablas de Next)
const LOCAL_PAGE = 10;
const page = ref(1);
const totalPages = computed(() => Math.max(1, Math.ceil((props.rows?.length ?? 0) / LOCAL_PAGE)));
const current = computed(() => Math.min(page.value, totalPages.value));
const visible = computed(() => props.rows?.slice((current.value - 1) * LOCAL_PAGE, current.value * LOCAL_PAGE));
</script>

<template>
  <Skeleton v-if="loading && !rows" class="h-48 w-full" />
  <div v-else class="overflow-x-auto rounded-lg border">
    <table class="w-full min-w-[640px] text-left text-sm" :aria-busy="loading || undefined">
      <caption class="sr-only">{{ caption }}</caption>
      <thead class="bg-slate-50 text-xs uppercase text-slate-600">
        <tr>
          <th v-for="column in columns" :key="column.key" scope="col" :class="['px-3 py-2.5 font-semibold', column.class]">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        <tr v-if="!rows?.length">
          <td :colspan="columns.length" class="px-3 py-8 text-center text-slate-500">{{ empty ?? $t('common.empty') }}</td>
        </tr>
        <tr v-for="row in visible" :key="rowKey(row)" class="hover:bg-slate-50">
          <td v-for="column in columns" :key="column.key" :class="['px-3 py-2.5 align-middle', column.class]">
            <!-- Slot dinámico por columna; sin slot se muestra el valor plano -->
            <slot :name="`cell-${column.key}`" :row="row">{{ (row as Record<string, unknown>)[column.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
    <!-- Paginación igual a la de Next (DataTable.tsx): botones secundarios "Anterior / Siguiente" -->
    <nav v-if="totalPages > 1" :aria-label="$t('common.pagination')" class="flex items-center justify-between border-t px-3 py-2 text-sm">
      <Button size="sm" variant="secondary" :disabled="current <= 1" @click="page = current - 1">{{ $t("common.previous") }}</Button>
      <span class="text-slate-600">{{ current }} / {{ totalPages }}</span>
      <Button size="sm" variant="secondary" :disabled="current >= totalPages" @click="page = current + 1">{{ $t("common.next") }}</Button>
    </nav>
  </div>
</template>
