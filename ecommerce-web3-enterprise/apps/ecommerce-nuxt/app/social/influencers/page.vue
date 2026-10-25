<!--
  page.vue (/social/influencers) => influencers con su desempeño y comisiones estimadas (Guard ADMIN/VENDOR).
  Las estadísticas se agregan en el navegador a partir de las publicaciones (sin endpoint extra).
-->
<script setup lang="ts">
import AdminHeading from "~~/shared/ui/AdminHeading.vue"; // Título + descripción desde el manifiesto del menú (igual que Next)
import { useApi } from "~~/shared/lib/api-client";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import { useSocialCommerce } from "~~/features/social-commerce/composable/useSocialCommerce";
import InfluencerCard from "~~/features/social-commerce/ui/InfluencerCard.vue";
import CommissionTracker from "~~/features/social-commerce/ui/CommissionTracker.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });

const api = socialApi(useApi());
const { data: posts } = useAsyncData("social-posts-100", async () => (await api.posts({ page: 1, limit: 100 })).data);
const { influencers } = useSocialCommerce(posts);
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminHeading nav-key="influencers" />
    <EmptyState v-if="!influencers.length" :title="$t('social.influencer.none')" />
    <template v-else>
      <ul class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <li v-for="influencer in influencers" :key="influencer.handle"><InfluencerCard :influencer="influencer" /></li>
      </ul>
      <CommissionTracker :influencers="influencers" />
    </template>
  </div>
</template>
