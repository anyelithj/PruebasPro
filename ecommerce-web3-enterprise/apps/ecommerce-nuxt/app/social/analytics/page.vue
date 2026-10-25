<!--
  page.vue (/social/analytics) => métricas por red social (Express /social/analytic: el vendedor ve solo las suyas) y
  ranking de influencers calculado de las publicaciones (Guard ADMIN/VENDOR). Gráficos SVG sin librerías.
-->
<script setup lang="ts">
import AdminHeading from "~~/shared/ui/AdminHeading.vue"; // Título + descripción desde el manifiesto del menú (igual que Next)
import { useApi } from "~~/shared/lib/api-client";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import { useSocialCommerce } from "~~/features/social-commerce/composable/useSocialCommerce";
import SocialAnalyticsDash from "~~/features/social-commerce/ui/SocialAnalyticsDash.vue";
import InfluencerRanking from "~~/widgets/social/InfluencerRanking.vue";
import Skeleton from "~~/shared/ui/Skeleton.vue";
import SocialSentimentPanel from "~~/features/social-commerce/ui/SocialSentimentPanel.vue"; // RF-15.11

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });

const api = socialApi(useApi());
// Dos consultas independientes en paralelo (Promise.all implícito de useAsyncData)
const { data: metrics, pending } = useAsyncData("social-analytics", () => api.analytics());
const { data: posts } = useAsyncData("social-posts-100", async () => (await api.posts({ page: 1, limit: 100 })).data);
const { influencers } = useSocialCommerce(posts);
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminHeading nav-key="socialAnalytics" />
    <Skeleton v-if="pending" class="h-64 w-full" />
    <SocialAnalyticsDash v-else :rows="metrics ?? []" />
    <InfluencerRanking :influencers="influencers" />
    <SocialSentimentPanel />
  </div>
</template>
