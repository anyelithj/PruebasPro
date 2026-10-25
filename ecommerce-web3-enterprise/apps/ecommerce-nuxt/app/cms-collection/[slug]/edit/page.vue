<!--
  page.vue (/cms-collection/[slug]/edit) => editar una colección (Guard ADMIN). Carga con sesión de staff para ver
  también colecciones no vigentes; permite archivarla (DELETE).
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import { cmsApi } from "~~/features/cms/api/cms.api";
import { useCmsStore } from "~~/features/cms/model/cms.store";
import CollectionForm from "~~/features/cms/ui/CollectionForm.vue";
import Button from "~~/shared/ui/Button.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });

const slug = String(useRoute().params["slug"]);
const api = cmsApi(useApi());
const toast = useToast();
const localePath = useLocalePath();
const { t } = useI18n();
const { data: collection, error } = await useAsyncData(`collection-edit:${slug}`, () => api.collection(slug));
if (error.value) throw createError({ statusCode: 404, fatal: true });
useSeoMeta({ title: () => t("collection.edit") });

const remove = async () => {
  if (!collection.value || !window.confirm(t("cms.confirmArchive", { title: collection.value.name }))) return;
  try {
    await api.deleteCollection(collection.value.id);
    toast.success(t("cms.archived"));
    useCmsStore().setListKind("collection"); // Listado único del CMS, pestaña Colecciones
    await navigateTo(localePath(routes.cmsPages));
  } catch (failure) {
    toast.error((failure as Error).message);
  }
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-2xl font-semibold">{{ $t("collection.edit") }}</h1>
      <div class="flex gap-2">
        <Button variant="dangerOutline" @click="remove">{{ $t("cms.archive") }}</Button>
        <ActionButton icon="close" :label="$t('common.back')" :to="localePath(routes.cmsPages)" />
      </div>
    </header>
    <CollectionForm v-if="collection" :key="collection.id" :collection="collection" />
  </div>
</template>
