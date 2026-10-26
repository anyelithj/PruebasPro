<!--
  SocialFeedWidget.vue (widget) => feed de publicaciones sociales con filtro por red y carga incremental al llegar al
  final (IntersectionObserver: sin escuchar el scroll). Compone SocialProductCard (feature). Patrones: Composite +
  Observer (filtro en Pinia, lista en useInfiniteList).
-->
<script setup lang="ts">
import type { SocialPost } from "~~/entities/social/model/social.types";
import type { PaginationMeta } from "~~/shared/types/api.types";
import { useApi } from "~~/shared/lib/api-client";
import { useInfiniteList } from "~~/shared/composable/useInfiniteScroll";
import SocialProductCard from "~~/features/social-commerce/ui/SocialProductCard.vue";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import { useSocialCommerce } from "~~/features/social-commerce/composable/useSocialCommerce";
import { PLATFORMS } from "~~/features/social-commerce/lib/social.validator";

const props = defineProps<{ initial: SocialPost[]; meta?: PaginationMeta | undefined }>();
const api = socialApi(useApi());
const { items, sentinel, loading } = useInfiniteList((page) => api.posts({ page, limit: 12 }), props.initial, props.meta?.totalPages ?? 1);
const { filtered, store } = useSocialCommerce(items);
</script>

<template>
  <section class="flex flex-col gap-4" :aria-label="$t('social.feed')">
    <label class="flex items-center gap-2 self-start text-sm">
      {{ $t("social.fields.platforms") }}
      <select :value="store.platform" class="h-9 rounded-md border border-slate-300 px-3 text-sm" @change="store.setPlatform(($event.target as HTMLSelectElement).value as never)">
        <option value="">{{ $t("common.all") }}</option>
        <option v-for="platform in PLATFORMS" :key="platform" :value="platform">{{ platform }}</option>
      </select>
    </label>
    <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" :aria-busy="loading || undefined">
      <li v-for="post in filtered" :key="post.id"><SocialProductCard :post="post" /></li>
    </ul>
    <!-- Centinela: al entrar en pantalla se pide la página siguiente -->
    <div ref="sentinel" class="h-1" aria-hidden="true" />
    <p aria-live="polite" class="text-center text-sm text-slate-500">{{ loading ? $t("common.loading") : "" }}</p>
  </section>
</template>
