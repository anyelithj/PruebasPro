<!--
  SocialSentimentPanel.vue (feature social-commerce · Vue 3 + Tailwind) => RF-15.11 sentimiento de redes sociales:
  distribución positivo/neutral/negativo/mixto, emociones promedio (RF-15.10), causas del sentimiento negativo con
  ejemplos y la conclusión del motor de FastAPI. Barras con CSS (sin librería de gráficos) y cifras en texto.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { formatPercent } from "~~/shared/lib/format";
import { socialApi } from "../api/social.api";

const LABELS = ["positive", "neutral", "negative", "mixed"] as const;
const { locale } = useI18n();
const api = socialApi(useApi());
const days = ref(30);
// "watch" => vuelve a consultar al cambiar el período; server:false => panel privado (no se renderiza en SSR)
const { data, pending, error } = useAsyncData("social-sentiment", () => api.sentiment(days.value), { watch: [days], server: false });

// emotions => promedio de cada emoción en todos los textos analizados (reduce sobre los ítems)
const emotions = computed(() => {
  const items = data.value?.items ?? [];
  const totals: Record<string, number> = {};
  for (const item of items) for (const [name, value] of Object.entries(item.emotions)) totals[name] = (totals[name] ?? 0) + value;
  return Object.entries(totals).map(([name, sum]) => ({ name, value: items.length ? sum / items.length : 0 })).sort((a, b) => b.value - a.value);
});
const share = (label: string) => (data.value?.summary.total ? (data.value.summary.counts[label] ?? 0) / data.value.summary.total : 0);
</script>

<template>
  <section aria-labelledby="sentiment-title" class="flex flex-col gap-4 rounded-xl border bg-white p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="sentiment-title" class="text-lg font-semibold">{{ $t("social.sentiment.title") }}</h2>
      <label class="flex items-center gap-2 text-sm">{{ $t("social.sentiment.period") }}
        <select v-model.number="days" class="h-9 rounded-md border border-slate-300 px-3 text-sm">
          <option v-for="value in [7, 30, 90]" :key="value" :value="value">{{ $t("social.sentiment.days", { n: value }) }}</option>
        </select>
      </label>
    </div>
    <p v-if="pending" class="text-sm text-slate-500">{{ $t("common.loading") }}</p>
    <p v-else-if="error" role="alert" class="text-sm text-red-600">{{ error.message }}</p>
    <template v-else-if="data">
      <p class="rounded-md bg-slate-50 p-3 text-sm">{{ data.conclusion }}</p>
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="label in LABELS" :key="label" class="flex flex-col gap-1 text-sm">
          <dt>{{ $t(`social.sentiment.labels.${label}`) }}</dt>
          <dd class="text-xl font-semibold tabular-nums">{{ formatPercent(share(label), locale) }}</dd>
        </div>
      </dl>
      <div v-if="emotions.length" class="flex flex-col gap-2">
        <h3 class="font-medium">{{ $t("social.sentiment.emotions") }}</h3>
        <ul class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <li v-for="emotion in emotions" :key="emotion.name" class="flex items-center gap-2">
            <span class="w-24 shrink-0">{{ $t(`social.sentiment.emotionNames.${emotion.name}`) }}</span>
            <span class="h-2 flex-1 overflow-hidden rounded bg-slate-200"><span class="block h-full bg-indigo-500" :style="{ width: `${emotion.value * 100}%` }" /></span>
            <span class="w-12 text-right tabular-nums">{{ formatPercent(emotion.value, locale) }}</span>
          </li>
        </ul>
      </div>
      <div class="flex flex-col gap-2">
        <h3 class="font-medium">{{ $t("social.sentiment.causes") }}</h3>
        <p v-if="!data.negative_causes.length" class="text-sm text-slate-500">{{ $t("social.sentiment.noCauses") }}</p>
        <ol class="flex flex-col gap-3">
          <li v-for="cause in data.negative_causes" :key="cause.cause" class="text-sm">
            <p class="font-medium">{{ cause.label }} · {{ cause.count }} ({{ formatPercent(cause.share, locale) }})</p>
            <ul class="ml-4 list-disc text-slate-600">
              <li v-for="example in cause.examples" :key="example">“{{ example }}”</li>
            </ul>
          </li>
        </ol>
      </div>
    </template>
  </section>
</template>
