<!--
  CommissionTracker.vue (Vue 3 + Pinia) => comisiones estimadas por influencer con la tasa configurable (Pinia) y
  total a pagar. La estimación usa compras × precio medio de los productos etiquetados (useSocialCommerce).
  Accesibilidad: tabla con <caption>, <th scope> y control de tasa con <label>.
-->
<script setup lang="ts">
import { computed } from "vue";
import type { InfluencerStats } from "~~/entities/social/model/social.types";
import { formatMoney, formatNumber } from "~~/shared/lib/format";
import { useSocialStore } from "../model/social.store";

const props = defineProps<{ influencers: InfluencerStats[] }>();
const store = useSocialStore();
const { locale } = useI18n();
const total = computed(() => props.influencers.reduce((sum, item) => sum + item.commissionCents, 0));
</script>

<template>
  <section class="flex flex-col gap-3 rounded-xl border bg-white p-4" aria-labelledby="commission-title">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 id="commission-title" class="text-base font-semibold">{{ $t("social.influencer.commissions") }}</h2>
      <label class="flex items-center gap-2 text-sm">
        {{ $t("social.influencer.rate") }}
        <input type="number" min="0" max="50" step="1" :value="Math.round(store.commissionRate * 100)" class="h-9 w-20 rounded-md border px-2" @change="store.setCommissionRate(Number(($event.target as HTMLInputElement).value) / 100)" >
        %
      </label>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[480px] text-left text-sm">
        <caption class="sr-only">{{ $t("social.influencer.commissions") }}</caption>
        <thead class="text-xs uppercase text-slate-500">
          <tr>
            <th scope="col" class="py-2">Influencer</th>
            <th scope="col" class="py-2 text-right">{{ $t("social.metrics.clicks") }}</th>
            <th scope="col" class="py-2 text-right">{{ $t("social.metrics.purchases") }}</th>
            <th scope="col" class="py-2 text-right">{{ $t("social.influencer.commission") }}</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="item in influencers" :key="item.handle">
            <th scope="row" class="py-2 font-medium">@{{ item.handle }}</th>
            <td class="py-2 text-right tabular-nums">{{ formatNumber(item.clicks, locale) }}</td>
            <td class="py-2 text-right tabular-nums">{{ item.purchases }}</td>
            <td class="py-2 text-right tabular-nums">{{ formatMoney(item.commissionCents, "COP", locale) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t font-semibold">
            <th scope="row" colspan="3" class="py-2">{{ $t("social.influencer.total") }}</th>
            <td class="py-2 text-right tabular-nums">{{ formatMoney(total, "COP", locale) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="text-xs text-slate-500">{{ $t("social.influencer.estimateHint") }}</p>
  </section>
</template>
