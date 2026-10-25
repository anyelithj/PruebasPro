<!--
  LandingCard.vue (widget) => tarjeta de landing en el listado: portada, título, resumen, oferta vigente y enlace.
  Patrón Factory (resumen del CMS -> tarjeta). Toda la tarjeta es un solo enlace (área táctil grande) con el título
  como nombre accesible. Imagen lazy con dimensiones fijas (aspect-ratio) => sin CLS.
-->
<script setup lang="ts">
import type { LandingSummary } from "~~/entities/landing/model/landing.types";
import { routes } from "~~/shared/constants/routes";
import CountdownTimer from "./CountdownTimer.vue";

defineProps<{ landing: LandingSummary }>();
const localePath = useLocalePath();
</script>

<template>
  <article class="group overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md">
    <NuxtLink :to="localePath(routes.landing(landing.slug))" class="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <img v-if="landing.coverUrl" :src="landing.coverUrl" :alt="landing.coverAlt ?? ''" loading="lazy" width="640" height="360" class="aspect-video w-full object-cover" >
      <div v-else class="aspect-video w-full bg-gradient-to-br from-slate-800 to-slate-600" aria-hidden="true" />
      <div class="flex flex-1 flex-col gap-2 p-4">
        <h2 class="text-lg font-semibold group-hover:underline">{{ landing.title }}</h2>
        <p v-if="landing.summary" class="line-clamp-2 text-sm text-slate-600">{{ landing.summary }}</p>
        <ClientOnly><CountdownTimer v-if="landing.data.endsAt" :ends-at="landing.data.endsAt" class="mt-auto self-start" /></ClientOnly>
      </div>
    </NuxtLink>
  </article>
</template>
