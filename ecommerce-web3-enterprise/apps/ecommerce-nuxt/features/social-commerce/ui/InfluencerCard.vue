<!--
  InfluencerCard.vue (Vue 3) => tarjeta de influencer: avatar, nombre, handle y desempeño (publicaciones, clics,
  compras, comisión estimada). Patrón Factory (estadísticas -> tarjeta). Avatar con iniciales si no hay imagen.
-->
<script setup lang="ts">
import type { InfluencerStats } from "~~/entities/social/model/social.types";
import { routes } from "~~/shared/constants/routes";
import { formatMoney, formatNumber } from "~~/shared/lib/format";

defineProps<{ influencer: InfluencerStats }>();
const { locale } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <article class="flex items-center gap-4 rounded-xl border bg-white p-4">
    <img v-if="influencer.avatarUrl" :src="influencer.avatarUrl" alt="" width="56" height="56" loading="lazy" class="size-14 rounded-full object-cover" >
    <span v-else class="flex size-14 items-center justify-center rounded-full bg-slate-200 font-semibold" aria-hidden="true">{{ influencer.displayName.slice(0, 2).toUpperCase() }}</span>
    <div class="flex flex-1 flex-col gap-1">
      <h2 class="font-semibold">
        <NuxtLink :to="localePath(routes.influencer(influencer.handle))" class="hover:underline">{{ influencer.displayName }}</NuxtLink>
      </h2>
      <p class="text-xs text-slate-500">@{{ influencer.handle }}</p>
      <p class="text-xs text-slate-600">
        {{ $t("social.influencer.summary", { posts: influencer.posts, clicks: formatNumber(influencer.clicks, locale), purchases: influencer.purchases }) }}
      </p>
    </div>
    <p class="text-right text-sm">
      <span class="block text-xs text-slate-500">{{ $t("social.influencer.commission") }}</span>
      <span class="font-semibold tabular-nums">{{ formatMoney(influencer.commissionCents, "COP", locale) }}</span>
    </p>
  </article>
</template>
