<!--
  page.vue (/search) => RF-06.2 / RF-06.4 búsqueda por IMAGEN: el cliente sube o toma una foto y recibe los productos
  visualmente similares (CLIP + pgvector en FastAPI) junto con lo que la IA reconoció: colores dominantes, patrón,
  textura y marca por su logo. La foto no se guarda en ningún servidor (solo se usa en memoria para la consulta).
  Accesibilidad: <input type="file"> nativo con label, vista previa con alt, resultados anunciados (aria-live).
  SEO: noindex (resultados personales, sin contenido estable).
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import type { StoreProduct } from "~~/entities/product/model/product.types";
import ProductGrid from "~~/features/product/ui/ProductGrid.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import Button from "~~/shared/ui/Button.vue";
import { routes } from "~~/shared/constants/routes";

interface VisualAttributes {
  colors: Array<{ name: string; hex: string; share: number }>;
  patterns: Array<{ label: string; score: number }>;
  textures: Array<{ label: string; score: number }>;
  brands: Array<{ label: string; score: number }>;
}

const { t } = useI18n();
const localePath = useLocalePath();
useSeoMeta({ title: () => t("store.visual.title"), robots: "noindex, follow" });
const api = useApi(); // Con sesión si existe: el historial de búsqueda queda en la cuenta (RF-06.3)
const preview = ref<string | null>(null);
const pending = ref(false);
const error = ref<string | null>(null);
const results = ref<StoreProduct[] | null>(null);
const attributes = ref<VisualAttributes | null>(null);

// chips => etiquetas legibles de lo reconocido (solo las de confianza razonable)
const chips = computed(() => {
  const a = attributes.value;
  if (!a) return [];
  const confident = (items: Array<{ label: string; score: number }>) => items.filter((item) => item.score >= 0.25).map((item) => item.label);
  return [...confident(a.patterns).slice(0, 1), ...confident(a.textures).slice(0, 1), ...confident(a.brands).slice(0, 1)];
});

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (preview.value) URL.revokeObjectURL(preview.value); // Libera la vista previa anterior (memoria)
  preview.value = URL.createObjectURL(file);
  pending.value = true;
  error.value = null;
  try {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<{ items: StoreProduct[]; attributes: VisualAttributes | null }>("/search/image", form);
    results.value = data.items;
    attributes.value = data.attributes;
  } catch (failure) {
    error.value = (failure as Error).message;
  } finally {
    pending.value = false;
  }
}
onBeforeUnmount(() => preview.value && URL.revokeObjectURL(preview.value));
</script>

<template>
  <section class="flex flex-col gap-6">
    <header>
      <h1 class="text-2xl font-semibold">{{ $t("store.visual.title") }}</h1>
      <p class="text-sm text-slate-600">{{ $t("store.visual.subtitle") }}</p>
    </header>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <label class="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm hover:bg-slate-50 focus-within:ring-2 focus-within:ring-accent sm:w-72">
        <img v-if="preview" :src="preview" :alt="$t('store.visual.previewAlt')" class="max-h-56 rounded-md object-contain" >
        <span v-else aria-hidden="true" class="text-4xl">📷</span>
        <span class="font-medium">{{ $t("store.visual.pick") }}</span>
        <!-- "capture" sin valor => el celular ofrece cámara o galería -->
        <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="onFile" >
      </label>
      <div v-if="attributes" aria-live="polite" class="flex flex-1 flex-col gap-3 rounded-xl border bg-white p-4 text-sm">
        <h2 class="font-semibold">{{ $t("store.visual.detected") }}</h2>
        <ul class="flex flex-wrap gap-2" :aria-label="$t('store.visual.colors')">
          <li v-for="color in attributes.colors" :key="color.name" class="flex items-center gap-1.5 rounded-full border px-2 py-1">
            <span class="size-4 rounded-full border" :style="{ backgroundColor: color.hex }" aria-hidden="true" />
            {{ color.name }} · {{ Math.round(color.share * 100) }} %
          </li>
        </ul>
        <ul v-if="chips.length" class="flex flex-wrap gap-2">
          <li v-for="chip in chips" :key="chip" class="rounded-full bg-slate-100 px-2 py-1">{{ chip }}</li>
        </ul>
      </div>
    </div>
    <p v-if="pending" role="status" class="text-sm text-slate-600">{{ $t("store.visual.searching") }}</p>
    <p v-else-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <ProductGrid v-else-if="results?.length" :products="results" :priority-count="4" />
    <EmptyState v-else-if="results" :title="$t('store.visual.emptyTitle')" :description="$t('store.visual.emptyText')">
      <Button :to="localePath(routes.products)">{{ $t("store.cart.browse") }}</Button>
    </EmptyState>
  </section>
</template>
