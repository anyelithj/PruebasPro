<!--
  page.vue (/social/influencers/[id]) => perfil de un influencer ([id] = handle): resumen, comisión y sus
  publicaciones (Express /social/product?influencer=). Guard ADMIN/VENDOR.
-->
<script setup lang="ts">
import { computed } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { routes } from "~~/shared/constants/routes";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import { useSocialCommerce } from "~~/features/social-commerce/composable/useSocialCommerce";
import InfluencerCard from "~~/features/social-commerce/ui/InfluencerCard.vue";
import SocialProductCard from "~~/features/social-commerce/ui/SocialProductCard.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });

const handle = String(useRoute().params["id"]).replace(/^@/, "").toLowerCase();
const api = socialApi(useApi());
const { data: posts } = useAsyncData(`influencer:${handle}`, async () => (await api.posts({ influencer: handle, limit: 50 })).data);
const { influencers } = useSocialCommerce(posts);
const influencer = computed(() => influencers.value[0]);
useSeoMeta({ title: () => `@${handle}` });
</script>

<template>
  <div class="flex flex-col gap-6">
    <BreadcrumbNav :items="[{ label: $t('admin.nav.influencers'), to: routes.influencers }, { label: `@${handle}` }]" />
    <EmptyState v-if="!influencer" :title="$t('social.influencer.none')" />
    <template v-else>
      <InfluencerCard :influencer="influencer" />
      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="post in posts ?? []" :key="post.id"><SocialProductCard :post="post" /></li>
      </ul>
    </template>
  </div>
</template>
