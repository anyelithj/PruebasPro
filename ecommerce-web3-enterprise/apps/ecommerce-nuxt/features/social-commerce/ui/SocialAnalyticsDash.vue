<!--
  SocialAnalyticsDash.vue (Vue 3 + SVG) => métricas por plataforma (impresiones, clics, compras, CTR) con barras SVG
  dibujadas a mano: reemplaza Chart.js (~200 KB) por ~30 líneas de marcado. Se renderiza en el servidor y no
  necesita JavaScript para verse. Accesibilidad: el gráfico es decorativo (aria-hidden) y la MISMA información está
  en una tabla accesible (WCAG 1.1.1). Patrón Observer (props reactivas) + Adapter (métricas -> barras).
-->
<script setup lang="ts">
import { computed } from "vue";
import type { SocialAnalytic } from "~~/entities/social/model/social.types";
import { formatNumber, formatPercent } from "~~/shared/lib/format";

const props = defineProps<{ rows: SocialAnalytic[] }>();
const { locale } = useI18n();
const COLORS: Record<string, string> = { INSTAGRAM: "#c026d3", FACEBOOK: "#2563eb", TIKTOK: "#0f172a", STORE: "#16a34a" };
const max = computed(() => Math.max(1, ...props.rows.map((row) => row.clicks)));
</script>

<template>
  <section class="flex flex-col gap-4 rounded-xl border bg-white p-4" aria-labelledby="social-dash-title">
    <h2 id="social-dash-title" class="text-base font-semibold">{{ $t("social.analytics.title") }}</h2>
    <svg :viewBox="`0 0 400 ${rows.length * 36}`" class="w-full" aria-hidden="true" preserveAspectRatio="none">
      <g v-for="(row, index) in rows" :key="row.platform" :transform="`translate(0 ${index * 36})`">
        <text x="0" y="22" font-size="12" fill="#475569">{{ row.platform }}</text>
        <rect x="90" y="8" :width="(row.clicks / max) * 300" height="20" rx="4" :fill="COLORS[row.platform] ?? '#64748b'" />
      </g>
    </svg>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[480px] text-left text-sm">
        <caption class="sr-only">{{ $t("social.analytics.title") }}</caption>
        <thead class="text-xs uppercase text-slate-500">
          <tr>
            <th scope="col" class="py-2">{{ $t("social.analytics.platform") }}</th>
            <th scope="col" class="py-2 text-right">{{ $t("social.analytics.posts") }}</th>
            <th scope="col" class="py-2 text-right">{{ $t("social.metrics.impressions") }}</th>
            <th scope="col" class="py-2 text-right">{{ $t("social.metrics.clicks") }}</th>
            <th scope="col" class="py-2 text-right">CTR</th>
            <th scope="col" class="py-2 text-right">{{ $t("social.metrics.purchases") }}</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="row in rows" :key="row.platform">
            <th scope="row" class="py-2 font-medium">{{ row.platform }}</th>
            <td class="py-2 text-right tabular-nums">{{ row.posts }}</td>
            <td class="py-2 text-right tabular-nums">{{ formatNumber(row.impressions, locale) }}</td>
            <td class="py-2 text-right tabular-nums">{{ formatNumber(row.clicks, locale) }}</td>
            <td class="py-2 text-right tabular-nums">{{ formatPercent(row.ctr, locale) }}</td>
            <td class="py-2 text-right tabular-nums">{{ formatNumber(row.purchases, locale) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
