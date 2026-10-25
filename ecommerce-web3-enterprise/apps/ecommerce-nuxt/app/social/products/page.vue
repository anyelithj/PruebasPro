<!--
  page.vue (/social/products) => panel de publicaciones sociales (Guard ADMIN/VENDOR, solo navegador): feed con filtro
  por red y carga incremental + diálogo para publicar. Tras publicar se recarga solo el feed (refresh).
-->
<script setup lang="ts">
import AdminHeading from "~~/shared/ui/AdminHeading.vue"; // Título + descripción desde el manifiesto del menú (igual que Next)
import { ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import SocialPublishForm from "~~/features/social-commerce/ui/SocialPublishForm.vue";
import SocialFeedWidget from "~~/widgets/social/SocialFeedWidget.vue";
import Button from "~~/shared/ui/Button.vue";
import Modal from "~~/shared/ui/Modal.vue";
import Skeleton from "~~/shared/ui/Skeleton.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });

const api = socialApi(useApi());
const open = ref(false);
const { data, pending, refresh } = useAsyncData("social-feed", () => api.posts({ page: 1, limit: 12 }));
const onPublished = async () => {
  open.value = false;
  await refresh();
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminHeading nav-key="socialProducts"><Button @click="open = true">{{ $t("common.new") }}</Button></AdminHeading>
    <Skeleton v-if="pending && !data" class="h-64 w-full" />
    <!-- "key" => tras publicar, el feed se reinicia con la primera página nueva -->
    <SocialFeedWidget v-else :key="data?.data[0]?.id ?? 'empty'" :initial="data?.data ?? []" :meta="data?.meta" />
    <Modal v-model:open="open" :title="$t('social.new')">
      <SocialPublishForm @published="onPublished" />
    </Modal>
  </div>
</template>
