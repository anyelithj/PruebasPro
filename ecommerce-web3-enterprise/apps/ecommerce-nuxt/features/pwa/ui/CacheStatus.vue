<!--
  CacheStatus.vue (Vue 3 + Cache Storage API) => tabla de cachés del Service Worker con entradas y estrategia de
  Workbox, uso del almacenamiento del dispositivo y botones para liberar espacio. Accesibilidad: tabla semántica,
  barra de uso con <progress> nativo (anunciado por lectores de pantalla).
-->
<script setup lang="ts">
import { onMounted } from "vue";
import Button from "~~/shared/ui/Button.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue"; // Acción de fila solo con ícono (ancho uniforme)
import { formatNumber } from "~~/shared/lib/format";
import { useCacheManager, STRATEGY_OF } from "../composable/useCacheManager";
import { clearableCache } from "../lib/pwa.validator";

const { caches, usage, loading, refresh, clear } = useCacheManager();
const { locale } = useI18n();
const mb = (bytes: number) => `${formatNumber(Math.round(bytes / 1024 / 1024), locale.value)} MB`;
const canClear = (name: string) => clearableCache.safeParse(name).success;
onMounted(refresh);
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="cache-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="cache-title" class="text-base font-semibold">{{ $t("pwa.cache.title") }}</h2>
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" :loading="loading" @click="refresh">{{ $t("pwa.cache.refresh") }}</Button>
        <Button size="sm" variant="danger" @click="clear()">{{ $t("pwa.cache.clearAll") }}</Button>
      </div>
    </div>
    <div v-if="usage" class="flex flex-col gap-1 text-sm">
      <label for="storage-usage">{{ $t("pwa.cache.usage", { used: mb(usage.used), quota: mb(usage.quota) }) }}</label>
      <progress id="storage-usage" :value="usage.used" :max="usage.quota || 1" class="h-2 w-full" />
    </div>
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[480px] text-left text-sm">
        <caption class="sr-only">{{ $t("pwa.cache.title") }}</caption>
        <thead class="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th scope="col" class="px-3 py-2">{{ $t("pwa.cache.name") }}</th>
            <th scope="col" class="px-3 py-2">{{ $t("pwa.cache.strategy") }}</th>
            <th scope="col" class="px-3 py-2 text-right">{{ $t("pwa.cache.entries") }}</th>
            <th scope="col" class="px-3 py-2 text-right">{{ $t("common.actions") }}</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-if="!caches.length"><td colspan="4" class="px-3 py-6 text-center text-slate-500">{{ $t("pwa.cache.empty") }}</td></tr>
          <tr v-for="item in caches" :key="item.name">
            <td class="px-3 py-2 font-mono text-xs">{{ item.name }}</td>
            <td class="px-3 py-2">{{ STRATEGY_OF[item.name] ?? "Precache" }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ item.entries }}</td>
            <td class="px-3 py-2 text-right">
              <ActionButton :disabled="!canClear(item.name)" icon="delete" :label="`${$t('pwa.cache.clear')} ${item.name}`" @click="clear(item.name)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
