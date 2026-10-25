<!--
  page.vue (/events/[slug]) => detalle de evento: fecha, lugar u online, cuenta regresiva, contenido visual y
  JSON-LD "Event" (Schema.org) para resultados enriquecidos (SSR + ISR, petición ANÓNIMA).
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { seoApi } from "~~/features/seo/api/seo.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam } from "~~/features/seo/lib/seo.validator";
import SchemaOrgMeta from "~~/features/seo/ui/SchemaOrgMeta.vue";
import CMSBlockRenderer from "~~/features/cms/ui/CMSBlockRenderer.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import CountdownTimer from "~~/widgets/landing/CountdownTimer.vue";
import { routes } from "~~/shared/constants/routes";
import { formatDateTime } from "~~/shared/lib/format";

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const api = seoApi(useApi({ anonymous: true }));
const { data: event, error } = await useAsyncData(`event:${slug.data}`, () => api.event(slug.data));
if (error.value || !event.value) throw createError({ statusCode: 404, fatal: true });
const { locale } = useI18n();
useSEOMeta(() => ({ title: event.value?.seo.title || event.value?.title || "", description: event.value?.seo.description || event.value?.summary, image: event.value?.media[0]?.url, path: routes.event(slug.data) }));
</script>

<template>
  <article v-if="event" class="flex flex-col gap-6">
    <SchemaOrgMeta type="Event" :data="{ title: event.title, description: event.summary, startsAt: event.data.startsAt, endsAt: event.data.endsAt, online: event.data.online, location: event.data.location, url: event.data.url, image: event.media[0]?.url }" />
    <BreadcrumbNav :items="[{ label: $t('events.title'), to: routes.events }, { label: event.title }]" />
    <header class="flex flex-col gap-3">
      <h1 class="text-3xl font-bold">{{ event.title }}</h1>
      <p class="text-slate-600">
        <time :datetime="event.data.startsAt">{{ formatDateTime(event.data.startsAt, locale) }}</time> –
        <time :datetime="event.data.endsAt">{{ formatDateTime(event.data.endsAt, locale) }}</time> ·
        {{ event.data.online ? $t("events.online") : event.data.location }}
      </p>
      <ClientOnly><CountdownTimer :ends-at="event.data.startsAt" :label="$t('events.startsIn')" class="self-start" /></ClientOnly>
      <a v-if="event.data.url" :href="event.data.url" rel="noopener" target="_blank" class="self-start text-sm text-accent underline">{{ $t("events.join") }}</a>
    </header>
    <img v-if="event.media[0]" :src="event.media[0].url" :alt="event.media[0].alt" width="1200" height="630" fetchpriority="high" class="aspect-[1200/630] w-full rounded-xl object-cover" >
    <CMSBlockRenderer v-if="event.body.html" :html="event.body.html" :css="event.body.css" />
  </article>
</template>
