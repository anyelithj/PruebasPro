<!--
  page.vue (/events) => agenda pública de eventos (SSR + ISR, petición ANÓNIMA): próximos por defecto y pasados con
  ?past=1 (enlace rastreable). Orden por fecha de inicio (lo hace Express). Patrón Composite (EventCard).
-->
<script setup lang="ts">
import { computed } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { seoApi } from "~~/features/seo/api/seo.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { eventsQuerySchema } from "~~/features/seo/lib/seo.validator";
import EventCard from "~~/features/seo/ui/EventCard.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import { routes } from "~~/shared/constants/routes";

const route = useRoute();
const query = computed(() => eventsQuerySchema.parse(route.query));
const { t, locale } = useI18n();
const api = seoApi(useApi({ anonymous: true }));
const { data } = await useAsyncData(() => `events:${locale.value}:${query.value.past ?? "up"}:${query.value.page}`, () => api.events({ locale: locale.value, upcoming: query.value.past ? undefined : "true", page: query.value.page, limit: 20 }), { watch: [query] });
useSEOMeta(() => ({ title: t("events.title"), description: t("events.description"), path: routes.events }));
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">{{ $t("events.title") }}</h1>
        <p class="mt-2 text-slate-600">{{ $t("events.description") }}</p>
      </div>
      <NuxtLink :to="{ query: query.past ? {} : { past: '1' } }" class="text-sm underline">{{ query.past ? $t("events.upcoming") : $t("events.past") }}</NuxtLink>
    </header>
    <EmptyState v-if="!data?.data.length" :title="$t('events.empty')" />
    <ul v-else class="flex flex-col gap-3">
      <li v-for="event in data.data" :key="event.id"><EventCard :event="event" /></li>
    </ul>
  </section>
</template>
