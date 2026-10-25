<!--
  CountdownTimer.vue (feature landing, VueUse vía useCountdown) => cuenta regresiva grande del hero (días, horas,
  minutos, segundos). Solo hace tic con la pestaña visible. Accesibilidad: el texto visible cambia cada segundo, por
  eso NO es una región aria-live (sería ruido); el lector lee una etiqueta con la fecha completa (role="timer").
-->
<script setup lang="ts">
import { useCountdown } from "~~/shared/composable/useCountdown";
import { formatDateTime } from "~~/shared/lib/format";

const props = defineProps<{ endsAt: string }>();
const remaining = useCountdown(() => props.endsAt);
const { locale } = useI18n();
const UNITS = ["days", "hours", "minutes", "seconds"] as const;
</script>

<template>
  <div role="timer" :aria-label="$t('landing.endsAt', { date: formatDateTime(endsAt, locale) })">
    <p v-if="remaining.done" class="text-sm font-medium">{{ $t("landing.ended") }}</p>
    <ul v-else class="flex gap-2" aria-hidden="true">
      <li v-for="unit in UNITS" :key="unit" class="flex w-16 flex-col items-center rounded-md bg-white/15 py-2">
        <span class="text-2xl font-bold tabular-nums">{{ String(remaining[unit]).padStart(2, "0") }}</span>
        <span class="text-[11px] uppercase tracking-wide">{{ $t(`landing.units.${unit}`) }}</span>
      </li>
    </ul>
  </div>
</template>
