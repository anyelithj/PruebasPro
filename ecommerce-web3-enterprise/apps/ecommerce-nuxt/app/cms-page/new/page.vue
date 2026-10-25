<!--
  page.vue (/cms-page/new?kind=page|landing|event|lookbook) => crear contenido con el editor visual dentro del MISMO
  layout del panel (menú lateral y cabecera iguales a Next.js); Guard: auth + rbac solo ADMIN, igual que Express.
  Un solo editor para los 4 tipos (DRY): el tipo se valida contra la lista permitida (allowlist).
-->
<script setup lang="ts">
import CMSPageEditor from "~~/features/cms/ui/CMSPageEditor.vue";
import type { ContentKind } from "~~/entities/cms/model/cms.types";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });

const route = useRoute();
const ALLOWED: ContentKind[] = ["page", "landing", "event", "lookbook"];
const kind = computed<ContentKind>(() => (ALLOWED.includes(route.query["kind"] as ContentKind) ? (route.query["kind"] as ContentKind) : "page"));
const { t } = useI18n();
useSeoMeta({ title: () => t("cms.newTitle", { kind: t(`cms.kinds.${kind.value}`) }) });
</script>

<template>
  <!-- "key" => cambiar de tipo crea un editor nuevo (estado limpio) -->
  <CMSPageEditor :key="kind" :kind="kind" />
</template>
