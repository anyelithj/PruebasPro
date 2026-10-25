<!--
  CountdownTimer.vue (widget, VueUse vía useCountdown) => versión COMPACTA de la cuenta regresiva para tarjetas de
  landings y eventos ("Termina en 2 d 04 h"). Comparte la lógica con la versión grande del hero (composable: DRY).
  Un tic por minuto basta para el texto compacto => se muestran días/horas/minutos (sin segundos: menos repintados).
-->
<script setup lang="ts">
import { computed } from "vue";
import { useCountdown } from "~~/shared/composable/useCountdown";

const props = defineProps<{ endsAt: string; label?: string }>();
const remaining = useCountdown(() => props.endsAt, 60_000);
const text = computed(() => `${remaining.value.days} d ${String(remaining.value.hours).padStart(2, "0")} h ${String(remaining.value.minutes).padStart(2, "0")} min`);
</script>

<template>
  <p class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
    <span aria-hidden="true">⏱</span>
    <span v-if="remaining.done">{{ $t("landing.ended") }}</span>
    <span v-else>{{ label ?? $t("landing.endsIn") }} <span class="tabular-nums">{{ text }}</span></span>
  </p>
</template>
