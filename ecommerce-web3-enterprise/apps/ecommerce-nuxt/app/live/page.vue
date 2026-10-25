<!--
  page.vue (/live) => RF-19.9 Live Shopping en la tienda: transmisiones en vivo y próximas (SSR, petición anónima).
  Patrones: Facade (socialApi). SEO: JSON-LD BroadcastEvent por transmisión (Google muestra la etiqueta "EN VIVO").
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { routes } from "~~/shared/constants/routes";
import { formatDateTime } from "~~/shared/lib/format";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import Badge from "~~/shared/ui/Badge.vue";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const api = socialApi(useApi({ anonymous: true }));
const { data: lives } = await useAsyncData("store-lives", () => api.lives().catch(() => []));

useSeoMeta({ title: () => t("store.live.title"), description: () => t("store.live.metaDescription") });
useHead({
  script: [{ type: "application/ld+json", innerHTML: JSON.stringify((lives.value ?? []).map((live) => ({ "@context": "https://schema.org", "@type": "BroadcastEvent", name: live.title, isLiveBroadcast: true, startDate: live.scheduledAt, description: live.description }))) }],
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-3xl font-semibold">{{ $t("store.live.title") }}</h1>
    <EmptyState v-if="!(lives ?? []).length" :title="$t('store.live.empty')" />
    <ul v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="live in lives ?? []" :key="live.id">
        <NuxtLink :to="localePath(routes.live(live.id))" class="flex h-full flex-col gap-2 rounded-xl border p-4 hover:shadow">
          <Badge :tone="live.status === 'LIVE' ? 'danger' : 'info'">{{ live.status === "LIVE" ? `● ${$t("store.live.now")}` : $t("store.live.upcoming") }}</Badge>
          <h2 class="text-lg font-semibold">{{ live.title }}</h2>
          <p class="line-clamp-2 text-sm text-slate-600">{{ live.description }}</p>
          <p class="text-xs text-slate-500">{{ formatDateTime(live.scheduledAt, locale) }} · {{ $t("store.live.products", { n: live.products.length }) }}</p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
