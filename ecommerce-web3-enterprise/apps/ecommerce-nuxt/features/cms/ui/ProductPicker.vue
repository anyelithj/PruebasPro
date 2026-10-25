<!--
  ProductPicker.vue (Vue 3) => buscador de productos del catálogo (Express /product?q=) para destacar productos en
  landings/lookbooks, armar colecciones y etiquetar fotos (hotspots). Búsqueda con debounce (menos peticiones).
  v-model = arreglo de IDs (selección múltiple) o evento "pick" (selección única para un hotspot).
  Accesibilidad: role="search", lista con casillas reales y conteo anunciado (aria-live).
-->
<script setup lang="ts">
import { ref, watch } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { useDebounce } from "~~/shared/composable/useDebounce";
import { formatMoney } from "~~/shared/lib/format";
import type { ProductCard } from "~~/shared/types/common.types";
import { cmsApi } from "../api/cms.api";
import Button from "~~/shared/ui/Button.vue";

const props = withDefaults(defineProps<{ single?: boolean }>(), { single: false });
const selected = defineModel<string[]>({ default: () => [] });
const emit = defineEmits<{ pick: [product: ProductCard] }>();

const api = cmsApi(useApi());
const term = ref("");
const debounced = useDebounce(term, 400);
const results = ref<ProductCard[]>([]);
const loading = ref(false);
const names = ref<Record<string, string>>({}); // id -> nombre de lo ya visto (chips legibles sin otra petición)
const { locale } = useI18n();

// Observer: cada término "estable" dispara UNA búsqueda (mínimo 2 caracteres)
watch(debounced, async (value) => {
  if (value.trim().length < 2) return void (results.value = []);
  loading.value = true;
  try {
    results.value = await api.searchProducts(value.trim());
    for (const product of results.value) names.value[product.id] = product.name;
  } finally {
    loading.value = false;
  }
});

const toggle = (product: ProductCard) => {
  if (props.single) return emit("pick", product);
  selected.value = selected.value.includes(product.id) ? selected.value.filter((id) => id !== product.id) : [...selected.value, product.id];
};
</script>

<template>
  <div class="flex flex-col gap-3">
    <div role="search">
      <label class="flex flex-col gap-1.5 text-sm font-medium">
        {{ $t("cms.products.search") }}
        <input v-model="term" type="search" class="h-9 rounded-md border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" :placeholder="$t('cms.products.placeholder')" >
      </label>
    </div>
    <ul v-if="!single && selected.length" class="flex flex-wrap gap-2" :aria-label="$t('cms.products.selected')">
      <li v-for="id in selected" :key="id" class="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
        {{ names[id] ?? id.slice(0, 8) }}
        <button type="button" class="rounded-full px-1 hover:bg-slate-200" :aria-label="$t('cms.products.remove', { name: names[id] ?? id })" @click="selected = selected.filter((item) => item !== id)">✕</button>
      </li>
    </ul>
    <p aria-live="polite" class="text-xs text-slate-500">{{ loading ? $t("common.loading") : term.length >= 2 ? $t("cms.products.found", { count: results.length }) : "" }}</p>
    <ul class="flex max-h-64 flex-col divide-y overflow-y-auto rounded-md border">
      <li v-for="product in results" :key="product.id">
        <label class="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
          <input v-if="!single" type="checkbox" class="size-4" :checked="selected.includes(product.id)" @change="toggle(product)" >
          <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.imageAlt ?? ''" width="40" height="40" loading="lazy" class="size-10 rounded object-cover" >
          <span class="flex-1">{{ product.name }}</span>
          <span class="tabular-nums text-slate-600">{{ formatMoney(product.minPriceCents, product.currency, locale) }}</span>
          <Button v-if="single" size="sm" variant="secondary" @click="toggle(product)">{{ $t("cms.products.choose") }}</Button>
        </label>
      </li>
    </ul>
  </div>
</template>
