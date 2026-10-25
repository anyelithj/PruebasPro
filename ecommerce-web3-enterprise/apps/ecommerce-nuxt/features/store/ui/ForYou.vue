<!--
  ForYou.vue (feature store · Vue 3 + VueUse + Tailwind) => RF-18.7 "Para ti" en la portada: productos destacados para
  CADA visitante según su historial (con sesión) y su contexto (hora local, dispositivo y país).
  Se pide en el NAVEGADOR (server: false): la portada sigue cacheada por ISR para todos y esta sección se personaliza
  después, sin bloquear el primer render (LCP). Patrón Facade (useApi) + Strategy (el backend elige la estrategia).
-->
<script setup lang="ts">
import { computed } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { useBreakpoint } from "~~/shared/composable/useMediaQuery";
import ProductGrid from "~~/features/product/ui/ProductGrid.vue";
import type { StoreProduct } from "~~/entities/product/model/product.types";

interface HomeFeed {
  reason: "HISTORY" | "CONTEXT" | "POPULAR";
  daypart: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
  products: StoreProduct[];
}

const api = useApi(); // Con token si hay sesión => personalización por historial
const tablet = useBreakpoint("md");
const desktop = useBreakpoint("lg");
const device = computed(() => (desktop.value ? "desktop" : tablet.value ? "tablet" : "mobile"));
const { data: feed } = useAsyncData(
  "home-for-you",
  async () => (await api.get<HomeFeed>("/recommendation/home", { hour: new Date().getHours(), device: device.value })).data,
  { server: false }
);
</script>

<template>
  <section v-if="feed?.products.length" aria-labelledby="for-you-title" class="flex flex-col gap-4">
    <div>
      <h2 id="for-you-title" class="text-2xl font-semibold">{{ $t(`store.forYou.title.${feed.reason}`) }}</h2>
      <p class="text-sm text-slate-600">{{ $t(`store.forYou.reason.${feed.reason}`, { daypart: $t(`store.forYou.dayparts.${feed.daypart}`) }) }}</p>
    </div>
    <ProductGrid :products="feed.products" />
  </section>
</template>
