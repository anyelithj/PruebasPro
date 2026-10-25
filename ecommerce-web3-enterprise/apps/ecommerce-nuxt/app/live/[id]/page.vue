<!--
  page.vue (/live/[id]) => RF-19.9 espectador de Live Shopping: reproductor embebido (YouTube/Facebook/TikTok), enlaces
  a la misma transmisión en cada red y los productos al lado con "Agregar al carrito". El producto FIJADO por el
  anfitrión se destaca; mientras está en vivo se consulta cada 10 s solo con la pestaña visible (VueUse: ahorra datos).
  Accesibilidad: iframe con title, región aria-live para el producto fijado, enlaces descriptivos.
-->
<script setup lang="ts">
import { computed } from "vue";
import { useDocumentVisibility, useIntervalFn } from "@vueuse/core";
import { useApi } from "~~/shared/lib/api-client";
import { routes } from "~~/shared/constants/routes";
import { formatDateTime } from "~~/shared/lib/format";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import ProductCard from "~~/features/product/ui/ProductCard.vue";
import type { StoreProduct } from "~~/entities/product/model/product.types";

const route = useRoute();
const id = String(route.params["id"] ?? "");
if (!/^[a-f0-9]{24}$/i.test(id)) throw createError({ statusCode: 404, fatal: true });
const { locale } = useI18n();
const localePath = useLocalePath();
const api = socialApi(useApi({ anonymous: true }));
const { data: live, refresh } = await useAsyncData(`live:${id}`, () => api.live(id).catch(() => null));
if (!live.value) throw createError({ statusCode: 404, fatal: true });

// Sondeo cada 10 s solo EN VIVO y con la pestaña visible (sin conexiones ni trabajo en segundo plano)
const visibility = useDocumentVisibility();
useIntervalFn(() => {
  if (live.value?.status === "LIVE" && visibility.value === "visible") void refresh();
}, 10_000);

const pinned = computed(() => live.value?.products.find((product) => product.id === live.value?.pinnedProductId) ?? null);
const others = computed(() => live.value?.products.filter((product) => product.id !== live.value?.pinnedProductId) ?? []);
const track = () => api.liveClick(id).catch(() => undefined); // Atribución: clic en un producto desde el live

useSeoMeta({ title: () => live.value?.title ?? "", description: () => live.value?.description.slice(0, 155) });
</script>

<template>
  <article v-if="live" class="flex flex-col gap-6">
    <NuxtLink :to="localePath(routes.lives)" class="text-sm text-slate-500 hover:underline">← {{ $t("store.live.title") }}</NuxtLink>
    <header class="flex flex-col gap-1">
      <p v-if="live.status === 'LIVE'" class="text-sm font-semibold text-red-600">● {{ $t("store.live.now") }}</p>
      <p v-else class="text-sm text-slate-500">{{ live.status === "ENDED" ? $t("store.live.ended") : formatDateTime(live.scheduledAt, locale) }}</p>
      <h1 class="text-3xl font-semibold">{{ live.title }}</h1>
      <p class="text-slate-600">{{ live.description }}</p>
    </header>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div class="flex flex-col gap-3">
        <div class="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe :src="live.embedUrl" :title="live.title" class="size-full" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" />
        </div>
        <ul v-if="live.streams.length" class="flex flex-wrap gap-2 text-sm">
          <li v-for="stream in live.streams" :key="stream.platform">
            <a :href="stream.url" target="_blank" rel="noopener" class="rounded-md border px-3 py-1 hover:bg-slate-50">{{ $t("store.live.watchOn", { platform: stream.platform }) }}</a>
          </li>
        </ul>
      </div>
      <aside class="flex flex-col gap-4" :aria-label="$t('store.live.productsTitle')">
        <section aria-live="polite">
          <template v-if="pinned">
            <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">📌 {{ $t("store.live.pinned") }}</h2>
            <div @click="track"><ProductCard :product="pinned as unknown as StoreProduct" priority /></div>
          </template>
        </section>
        <h2 class="text-sm font-semibold">{{ $t("store.live.productsTitle") }}</h2>
        <ul class="grid grid-cols-2 gap-3">
          <li v-for="product in others" :key="product.id" @click="track"><ProductCard :product="product as unknown as StoreProduct" /></li>
        </ul>
      </aside>
    </div>
  </article>
</template>
