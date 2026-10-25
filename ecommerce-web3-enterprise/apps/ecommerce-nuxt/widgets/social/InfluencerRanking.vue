<!--
  InfluencerRanking.vue (widget + SVG) => top 5 de influencers por compras con barras SVG proporcionales (sin
  librerías de gráficos). Lista ordenada (<ol>) con el valor en texto: el gráfico es redundante para lectores de
  pantalla (aria-hidden). Patrón Composite + Adapter (estadísticas -> barras).
-->
<script setup lang="ts">
import { computed } from "vue";
import type { InfluencerStats } from "~~/entities/social/model/social.types";

const props = defineProps<{ influencers: InfluencerStats[] }>();
const top = computed(() => props.influencers.slice(0, 5));
const max = computed(() => Math.max(1, ...top.value.map((item) => item.purchases)));
</script>

<template>
  <section class="flex flex-col gap-3 rounded-xl border bg-white p-4" aria-labelledby="ranking-title">
    <h2 id="ranking-title" class="text-base font-semibold">{{ $t("social.influencer.ranking") }}</h2>
    <p v-if="!top.length" class="text-sm text-slate-500">{{ $t("social.influencer.none") }}</p>
    <ol class="flex flex-col gap-2">
      <li v-for="(item, index) in top" :key="item.handle" class="flex items-center gap-3 text-sm">
        <span class="w-5 text-right font-semibold text-slate-500">{{ index + 1 }}</span>
        <span class="w-32 truncate">@{{ item.handle }}</span>
        <svg viewBox="0 0 100 10" class="h-3 flex-1" preserveAspectRatio="none" aria-hidden="true">
          <rect width="100" height="10" rx="2" fill="#e2e8f0" />
          <rect :width="(item.purchases / max) * 100" height="10" rx="2" fill="#2563eb" />
        </svg>
        <span class="w-16 text-right tabular-nums">{{ $t("social.influencer.purchases", { count: item.purchases }) }}</span>
      </li>
    </ol>
  </section>
</template>
