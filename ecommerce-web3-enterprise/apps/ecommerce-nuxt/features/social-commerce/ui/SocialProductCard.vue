<!--
  SocialProductCard.vue (Vue 3) => tarjeta de publicación social: imagen, redes, estado, influencer, métricas y
  productos etiquetados con enlace a la tienda. Patrón Factory (publicación -> tarjeta) + Strategy (tono del estado).
  Accesibilidad: <article> con título (texto de la publicación), métricas como lista de definiciones (<dl>).
-->
<script setup lang="ts">
import type { SocialPost } from "~~/entities/social/model/social.types";
import { routes } from "~~/shared/constants/routes";
import { formatNumber } from "~~/shared/lib/format";
import Badge from "~~/shared/ui/Badge.vue";

defineProps<{ post: SocialPost }>();
const { locale } = useI18n();
const localePath = useLocalePath();
const TONE = { PUBLISHED: "success", SCHEDULED: "info", PUBLISHING: "info", DRAFT: "neutral", FAILED: "danger" } as const;
const METRICS = ["impressions", "clicks", "purchases"] as const;
</script>

<template>
  <article class="flex flex-col overflow-hidden rounded-xl border bg-white">
    <img :src="post.mediaUrl" :alt="post.mediaAlt" loading="lazy" width="480" height="480" class="aspect-square w-full object-cover" >
    <div class="flex flex-1 flex-col gap-3 p-4">
      <div class="flex flex-wrap items-center gap-2">
        <Badge :tone="TONE[post.status]">{{ $t(`social.status.${post.status}`) }}</Badge>
        <Badge v-for="platform in post.platforms" :key="platform" tone="info">{{ platform }}</Badge>
      </div>
      <h2 class="line-clamp-2 text-sm font-medium">
        <NuxtLink :to="localePath(routes.socialProduct(post.id))" class="hover:underline">{{ post.caption }}</NuxtLink>
      </h2>
      <p v-if="post.influencer" class="text-xs text-slate-600">@{{ post.influencer.handle }}<span v-if="post.referralCode"> · {{ post.referralCode }}</span></p>
      <dl class="grid grid-cols-3 gap-2 text-center text-xs">
        <div v-for="metric in METRICS" :key="metric" class="rounded-md bg-slate-50 py-1.5">
          <dt class="text-slate-500">{{ $t(`social.metrics.${metric}`) }}</dt>
          <dd class="font-semibold tabular-nums">{{ formatNumber(post.metrics[metric], locale) }}</dd>
        </div>
      </dl>
      <ul v-if="post.products.length" class="mt-auto flex flex-wrap gap-1 text-xs">
        <li v-for="product in post.products" :key="product.id">
          <NuxtLink :to="localePath(routes.product(product.slug))" class="rounded-full border px-2 py-0.5 hover:bg-slate-50">{{ product.name }}</NuxtLink>
        </li>
      </ul>
    </div>
  </article>
</template>
