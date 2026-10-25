<!--
  page.vue (/cms-collection/new) => crear una colección del catálogo (Guard ADMIN; Express también exige el permiso
  CREATE:collection). Formulario compartido con la edición (CollectionForm: DRY).
-->
<script setup lang="ts">
import CollectionForm from "~~/features/cms/ui/CollectionForm.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue";
import { routes } from "~~/shared/constants/routes";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });
const { t } = useI18n();
const localePath = useLocalePath();
useSeoMeta({ title: () => t("collection.new") });
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold">{{ $t("common.new") }}</h1>
      <ActionButton icon="close" :label="$t('common.back')" :to="localePath(routes.cmsPages)" />
    </div>
    <CollectionForm />
  </div>
</template>
