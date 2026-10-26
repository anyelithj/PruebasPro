<!--
  CarrierStatsTable.vue (Vue 3 + Nuxt + Tailwind) => RF-10.7 desempeño de cada transportadora (GET /shipping/stats):
  envíos, entregas a tiempo, días promedio, devoluciones y retrasos abiertos. El cumplimiento también alimenta la
  recomendación automática de transportadora en el checkout (RF-10.2).
  Accesibilidad: <table> con <caption> y <th scope>; responsive con scroll horizontal propio (sin romper la página).
-->
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { formatMoney } from "~~/shared/lib/format";
import type { CarrierStats } from "~~/entities/pwa/model/pwa.types";

const api = useApi();
const { locale } = useI18n();
const days = ref(90); // Período del reporte (selector: 30, 90 o 365 días)
// useAsyncData + watch => vuelve a consultar al cambiar el período; "server: false" => dato privado del panel
const { data, pending } = await useAsyncData(() => `carrier-stats:${days.value}`, async () => (await api.get<CarrierStats[]>("/shipping/stats", { days: days.value })).data, { watch: [days], server: false });
const percent = (value: number) => `${Math.round(value * 100)} %`;
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex items-center gap-2 self-start text-sm">
      {{ $t("config.shipping.statsPeriod") }}
      <select v-model.number="days" class="h-9 rounded-md border border-slate-300 px-3 text-sm">
        <option :value="30">30</option>
        <option :value="90">90</option>
        <option :value="365">365</option>
      </select>
    </label>
    <p v-if="pending" class="text-sm text-slate-500">{{ $t("common.loading") }}</p>
    <p v-else-if="!data?.length" class="text-sm text-slate-500">{{ $t("config.shipping.statsEmpty") }}</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[640px] text-sm">
        <caption class="sr-only">{{ $t("config.shipping.statsTitle") }}</caption>
        <thead class="border-b text-left text-slate-600">
          <tr>
            <th scope="col" class="py-2 pr-3">{{ $t("config.shipping.code") }}</th>
            <th scope="col" class="py-2 pr-3 text-right">{{ $t("config.shipping.statsShipments") }}</th>
            <th scope="col" class="py-2 pr-3 text-right">{{ $t("config.shipping.statsOnTime") }}</th>
            <th scope="col" class="py-2 pr-3 text-right">{{ $t("config.shipping.statsAvgDays") }}</th>
            <th scope="col" class="py-2 pr-3 text-right">{{ $t("config.shipping.statsReturned") }}</th>
            <th scope="col" class="py-2 pr-3 text-right">{{ $t("config.shipping.statsDelayed") }}</th>
            <th scope="col" class="py-2 text-right">{{ $t("config.shipping.statsCost") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data" :key="row.carrier" class="border-b last:border-0">
            <th scope="row" class="py-2 pr-3 text-left font-medium">{{ row.carrier }}</th>
            <td class="py-2 pr-3 text-right tabular-nums">{{ row.shipments }}</td>
            <td class="py-2 pr-3 text-right tabular-nums">{{ row.delivered ? percent(row.onTimeRate) : "—" }}</td>
            <td class="py-2 pr-3 text-right tabular-nums">{{ row.avgDeliveryDays ?? "—" }}</td>
            <td class="py-2 pr-3 text-right tabular-nums">{{ row.returned }}</td>
            <td :class="['py-2 pr-3 text-right tabular-nums', row.delayedOpen > 0 && 'font-semibold text-amber-700']">{{ row.delayedOpen }}</td>
            <td class="py-2 text-right tabular-nums">{{ formatMoney(row.costCents, "COP", locale) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
