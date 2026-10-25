<!--
  page.vue (/social/products/[id]) => detalle de una publicación: imagen, texto, redes, métricas, productos y, si
  falló la publicación, el error devuelto por la red. Permite borrarla (Express la retira del feed).
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import { formatDateTime } from "~~/shared/lib/format";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import SocialProductCard from "~~/features/social-commerce/ui/SocialProductCard.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import Button from "~~/shared/ui/Button.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });

const id = String(useRoute().params["id"]);
const api = socialApi(useApi());
const toast = useToast();
const localePath = useLocalePath();
const { t, locale } = useI18n();
const { data: post, error } = await useAsyncData(`social-post:${id}`, () => api.post(id));
if (error.value) throw createError({ statusCode: 404, fatal: true });
useSeoMeta({ title: () => t("social.detail") });

const remove = async () => {
  if (!window.confirm(t("social.confirmDelete"))) return;
  try {
    await api.remove(id);
    toast.success(t("social.deleted"));
    await navigateTo(localePath(routes.socialProducts));
  } catch (failure) {
    toast.error((failure as Error).message);
  }
};
</script>

<template>
  <div v-if="post" class="flex flex-col gap-6">
    <BreadcrumbNav :items="[{ label: $t('admin.nav.socialProducts'), to: routes.socialProducts }, { label: $t('social.detail') }]" />
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <SocialProductCard :post="post" />
      <section class="flex flex-col gap-3 rounded-xl border bg-white p-4 text-sm">
        <p class="whitespace-pre-line">{{ post.caption }}</p>
        <p v-if="post.publishedAt">{{ $t("social.publishedAt", { date: formatDateTime(post.publishedAt, locale) }) }}</p>
        <p v-else-if="post.scheduledAt">{{ $t("social.scheduledFor", { date: formatDateTime(post.scheduledAt, locale) }) }}</p>
        <p v-if="post.error" role="alert" class="rounded-md bg-red-50 p-3 text-red-800">{{ post.error }}</p>
        <Button variant="dangerOutline" class="self-end" @click="remove">{{ $t("common.delete") }}</Button>
      </section>
    </div>
  </div>
</template>
