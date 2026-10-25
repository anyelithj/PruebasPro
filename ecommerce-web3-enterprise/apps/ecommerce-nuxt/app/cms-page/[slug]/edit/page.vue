<!--
  page.vue (/cms-page/[slug]/edit?kind=) => editar página, landing, evento o lookbook (Guard ADMIN), en el layout del panel. Carga el documento
  completo (con proyecto GrapesJS) con sesión de staff para ver también borradores.
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { cmsApi } from "~~/features/cms/api/cms.api";
import CMSPageEditor from "~~/features/cms/ui/CMSPageEditor.vue";
import Skeleton from "~~/shared/ui/Skeleton.vue";
import type { ContentKind } from "~~/entities/cms/model/cms.types";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });

const route = useRoute();
const ALLOWED: ContentKind[] = ["page", "landing", "event", "lookbook"];
const kind: ContentKind = ALLOWED.includes(route.query["kind"] as ContentKind) ? (route.query["kind"] as ContentKind) : "page";
const slug = String(route.params["slug"]);
const api = cmsApi(useApi());
const { data: content, error } = await useAsyncData(`cms-edit:${kind}:${slug}`, () => api.get(kind, slug));
if (error.value) throw createError({ statusCode: 404, fatal: true });
const { t } = useI18n();
useSeoMeta({ title: () => t("cms.editTitle", { kind: t(`cms.kinds.${kind}`) }) });
</script>

<template>
  <CMSPageEditor v-if="content" :key="content.id" :kind="kind" :content="content" />
  <Skeleton v-else class="h-[70vh] w-full" />
</template>
