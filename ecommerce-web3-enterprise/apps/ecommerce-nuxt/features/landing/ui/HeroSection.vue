<!--
  HeroSection.vue (Vue 3 + Web Animations API vía useLanding) => portada de la landing: imagen de fondo (LCP con
  prioridad alta), titular, resumen y llamado a la acción. El HTML llega completo desde el servidor (SSR/ISR:
  visible y legible por buscadores antes de cargar JavaScript); la animación es solo una mejora progresiva.
  Contraste AA: capa oscura sobre la imagen. Patrón Observer (useLanding observa visibilidad y clics).
-->
<script setup lang="ts">
import { ref } from "vue";
import type { Landing } from "~~/entities/landing/model/landing.types";
import { useLanding } from "../composable/useLanding";
import CountdownTimer from "./CountdownTimer.vue";

const props = defineProps<{ landing: Landing }>();
const root = ref<HTMLElement | null>(null);
const { trackCta } = useLanding(props.landing.slug, root);
const cover = props.landing.media[0];
</script>

<template>
  <section ref="root" class="relative isolate flex min-h-[70vh] items-center overflow-hidden bg-brand px-4 pb-16 pt-24 text-white">
    <img v-if="cover" :src="cover.url" :alt="cover.alt" :width="cover.width ?? undefined" :height="cover.height ?? undefined" fetchpriority="high" class="absolute inset-0 -z-10 size-full object-cover" >
    <div class="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 to-black/30" aria-hidden="true" />
    <div class="mx-auto flex w-full max-w-4xl flex-col items-start gap-5">
      <h1 data-reveal class="text-4xl font-bold leading-tight sm:text-5xl">{{ landing.data.headline || landing.title }}</h1>
      <p v-if="landing.summary" data-reveal class="max-w-2xl text-lg text-slate-100">{{ landing.summary }}</p>
      <!-- ClientOnly => la hora "ahora" difiere entre servidor y navegador: se dibuja solo en el cliente (sin desajustes de hidratación) -->
      <ClientOnly><div v-if="landing.data.endsAt" data-reveal><CountdownTimer :ends-at="landing.data.endsAt" /></div></ClientOnly>
      <p v-if="landing.data.couponCode" data-reveal class="rounded-md bg-white/15 px-3 py-1.5 text-sm">
        {{ $t("landing.coupon") }} <strong class="font-mono tracking-wider">{{ landing.data.couponCode }}</strong>
      </p>
      <a v-if="landing.data.ctaUrl" data-reveal :href="landing.data.ctaUrl" class="inline-flex h-12 items-center rounded-md bg-white px-6 font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" @click="trackCta(landing.data.ctaLabel ?? 'cta')">
        {{ landing.data.ctaLabel || $t("landing.cta") }}
      </a>
    </div>
  </section>
</template>
