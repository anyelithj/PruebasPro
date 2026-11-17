<!--
  DataTable.vue (Vue 3, componente genérico) => tabla de datos del panel: columnas declarativas, celdas
  personalizables por slot ("cell-<clave>"), estados de carga/vacío. Patrones: Composite (columnas como datos) +
  Template Method (estructura fija, celdas variables). "generic" => tipado de la fila (Vue 3.3+).
  Paginación: con "meta" la hace el servidor (emite "page"); sin él, en el navegador. Máximo 10 filas por vista.
  Accesibilidad: <table> semántica, <caption>, <th scope="col">, aria-busy; responsive: en móvil las filas se apilan como
  bloques (display:block quita la semántica de tabla, por eso los role explícitos la conservan). Espejo de DataTable.tsx.
-->
<script setup lang="ts" generic="T">
import { computed } from "vue";
import Skeleton from "./Skeleton.vue";
import TablePager from "./TablePager.vue";
import { useLocalPage } from "../composable/useLocalPage";
import type { Column } from "../types/common.types";
import type { PaginationMeta } from "../types/api.types";

const props = defineProps<{
  caption: string;
  columns: Column[];
  rows: T[] | null | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: string;
  meta?: PaginationMeta | undefined;
}>();
const emit = defineEmits<{ page: [page: number] }>();

const local = useLocalPage(() => props.rows);
const visible = computed(() => (props.meta ? (props.rows ?? []) : local.visible.value) as T[]);
const pagerMeta = computed(() => props.meta ?? local.meta.value);
const onPage = (page: number) => (props.meta ? emit("page", page) : (local.page.value = page));
</script>

<template>
  <Skeleton v-if="loading && !rows" class="h-48 w-full" />
  <div v-else class="flex flex-col gap-3">
    <div class="overflow-hidden rounded-lg border sm:overflow-x-auto">
      <table role="table" class="w-full text-left text-sm max-sm:block sm:min-w-[640px]" :aria-busy="loading || undefined">
        <caption class="sr-only">{{ caption }}</caption>
        <thead role="rowgroup" class="bg-slate-100 text-xs text-slate-600 max-sm:sr-only">
          <tr role="row">
            <th v-for="column in columns" :key="column.key" role="columnheader" scope="col" :class="['px-3 py-2.5 font-semibold', column.class]">{{ column.label }}</th>
          </tr>
        </thead>
        <tbody role="rowgroup" class="divide-y max-sm:block">
          <tr v-if="!rows?.length" role="row" class="max-sm:block">
            <td role="cell" :colspan="columns.length" class="px-3 py-8 text-center text-slate-500 max-sm:block">{{ empty ?? $t('common.empty') }}</td>
          </tr>
          <tr v-for="row in visible" :key="rowKey(row)" role="row" class="hover:bg-slate-50 max-sm:block max-sm:py-2">
            <td v-for="column in columns" :key="column.key" role="cell" :data-label="column.label" :class="['px-3 py-2.5 align-middle max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:py-1.5 max-sm:text-right max-sm:before:text-left max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-slate-500 max-sm:before:content-[attr(data-label)]', column.class]">
              <!-- Slot dinámico por columna; sin slot se muestra el valor plano -->
              <slot :name="`cell-${column.key}`" :row="row">{{ (row as Record<string, unknown>)[column.key] }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <TablePager :meta="pagerMeta" @page="onPage" />
  </div>
</template>
