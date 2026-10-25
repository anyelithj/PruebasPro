<!--
  EventCard.vue (Vue 3) => tarjeta de evento: fecha destacada, título, lugar/online y cuenta regresiva si no empezó.
  Patrón Factory (evento -> tarjeta). <time datetime> para fechas legibles por máquinas; enlace con nombre accesible.
-->
<script setup lang="ts">
import { computed } from "vue";
import type { SeoEventSummary } from "~~/entities/blog/model/blog.types";
import { formatDateTime } from "~~/shared/lib/format";
import { routes } from "~~/shared/constants/routes";

const props = defineProps<{ event: SeoEventSummary }>();
const { locale } = useI18n();
const localePath = useLocalePath();
const start = computed(() => new Date(props.event.data.startsAt));
</script>

<template>
  <article class="group flex gap-4 rounded-xl border bg-white p-4">
    <div class="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-brand py-2 text-white" aria-hidden="true">
      <span class="text-2xl font-bold leading-none">{{ start.getDate() }}</span>
      <span class="text-xs uppercase">{{ start.toLocaleString(locale === "en" ? "en-US" : "es-CO", { month: "short" }) }}</span>
    </div>
    <div class="flex flex-1 flex-col gap-1">
      <h2 class="text-lg font-semibold">
        <NuxtLink :to="localePath(routes.event(event.slug))" class="group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{{ event.title }}</NuxtLink>
      </h2>
      <p class="text-sm text-slate-600"><time :datetime="event.data.startsAt">{{ formatDateTime(event.data.startsAt, locale) }}</time> · {{ event.data.online ? $t("events.online") : event.data.location }}</p>
      <p v-if="event.summary" class="line-clamp-2 text-sm text-slate-600">{{ event.summary }}</p>
    </div>
  </article>
</template>
