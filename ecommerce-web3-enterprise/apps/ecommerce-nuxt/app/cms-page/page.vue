<!--
  page.vue (/cms-page) => listado ÚNICO del CMS (Guard: auth + rbac): páginas, landings, eventos, lookbooks y
  colecciones con un filtro "Tipo", con la MISMA tabla, las MISMAS acciones (íconos de ancho uniforme) y el MISMO editor
  para los 4 tipos de contenido (CMSPageEditor). Antes lookbooks y colecciones abrían galerías públicas con otra
  interfaz; ahora todo se administra desde aquí y la galería pública queda solo para los visitantes.
  Solo navegador (routeRules: ssr false). La pestaña activa vive en Pinia (se conserva al volver del editor).
  Patrones: Adapter (toRow unifica contenido y colecciones en una sola forma de fila), Strategy (URL por tipo),
  Composite (DataTable con celdas por slot). Accesibilidad: select con <label> y acciones con texto sr-only.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import { formatDateTime } from "~~/shared/lib/format";
import { cmsApi } from "~~/features/cms/api/cms.api";
import { useCmsStore, type ListKind } from "~~/features/cms/model/cms.store";
import type { CatalogCollection, CmsContentSummary, ContentStatus } from "~~/entities/cms/model/cms.types";
import DataTable from "~~/shared/ui/DataTable.vue";
import Pagination from "~~/shared/ui/Pagination.vue";
import Badge from "~~/shared/ui/Badge.vue";
import Button from "~~/shared/ui/Button.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue";
import AdminHeading from "~~/shared/ui/AdminHeading.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });

// Row => forma común de fila (Adapter): contenido del CMS (MongoDB) y colecciones del catálogo (PostgreSQL)
interface Row {
  id: string;
  kind: ListKind;
  slug: string;
  title: string;
  status: ContentStatus;
  updatedAt: string | null;
}

const { t, locale } = useI18n();
const toast = useToast();
const localePath = useLocalePath();
const store = useCmsStore();
const api = cmsApi(useApi());
const page = ref(1);
const KINDS: ListKind[] = ["page", "landing", "event", "lookbook", "collection"];

// toRow => Adapter de cada fuente a Row (colección activa = publicada, inactiva = borrador)
const fromContent = (item: CmsContentSummary): Row => ({ id: item.id, kind: item.kind, slug: item.slug, title: item.title, status: item.status, updatedAt: item.updatedAt });
const fromCollection = (item: CatalogCollection): Row => ({ id: item.id, kind: "collection", slug: item.slug, title: item.name, status: item.isActive ? "PUBLISHED" : "DRAFT", updatedAt: null });

// fetchRows => una sola función para las 5 pestañas (la fuente cambia, la forma de la respuesta no)
const fetchRows = async () => {
  const query = { page: page.value, limit: 10 }; // 10 filas por página: igual que todas las tablas del panel
  if (store.listKind === "collection") {
    const result = await api.collections(query);
    return { ...result, data: result.data.map(fromCollection) };
  }
  const result = await api.list(store.listKind, query);
  return { ...result, data: result.data.map(fromContent) };
};
// "watch" de useAsyncData => vuelve a pedir al cambiar pestaña o página (clave única por combinación: caché correcta)
const { data, pending, refresh } = useAsyncData(() => `cms-admin:${store.listKind}:${page.value}`, fetchRows, { watch: [() => store.listKind, page] });

const TONE = { PUBLISHED: "success", DRAFT: "neutral", ARCHIVED: "warning" } as const;
const columns = computed(() => [
  { key: "title", label: t("cms.fields.title") },
  { key: "status", label: t("cms.fields.status") },
  { key: "updatedAt", label: t("cms.updated") },
  { key: "actions", label: t("common.actions"), class: "w-px text-right" }, // "w-px" => la columna mide solo sus íconos
]);

// Strategy por tipo: URL de creación, edición y vista pública (las colecciones tienen su propio formulario)
const newUrl = computed(() => localePath(store.listKind === "collection" ? routes.collectionNew : `${routes.cmsPageNew}?kind=${store.listKind}`));
const editUrl = (row: Row) => localePath(row.kind === "collection" ? routes.collectionEdit(row.slug) : `${routes.cmsPageEdit(row.slug)}?kind=${row.kind}`);
const PUBLIC_URL: Record<ListKind, (slug: string) => string> = { page: routes.cmsPage, landing: routes.landing, event: routes.event, lookbook: routes.lookbook, collection: routes.collection };
const publicUrl = (row: Row) => localePath(PUBLIC_URL[row.kind](row.slug));

const archive = async (row: Row) => {
  if (!window.confirm(t("cms.confirmArchive", { title: row.title }))) return; // Diálogo nativo: accesible y 0 KB
  try {
    await (row.kind === "collection" ? api.deleteCollection(row.id) : api.archive(row.kind, row.id));
    toast.success(t("cms.archived"));
    await refresh();
  } catch (error) {
    toast.error((error as Error).message);
  }
};
const selectKind = (kind: ListKind) => {
  store.setListKind(kind);
  page.value = 1; // La página 3 de otra pestaña podría no existir
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Encabezado = texto del menú ("Contenido del sitio") + descripción + acción principal (igual que Next.js) -->
    <AdminHeading nav-key="content"><Button :to="newUrl">{{ $t("common.new") }}</Button></AdminHeading>
    <!-- Un solo listado con filtro "Tipo" (antes 5 pestañas con la misma tabla): mismo control que los filtros de Next -->
    <label class="flex w-full flex-col gap-1.5 text-sm font-medium sm:w-60">
      {{ $t("cms.kindFilter") }}
      <select :value="store.listKind" class="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" @change="selectKind(($event.target as HTMLSelectElement).value as ListKind)">
        <option v-for="kind in KINDS" :key="kind" :value="kind">{{ $t(`cms.kindsPlural.${kind}`) }}</option>
      </select>
    </label>
    <DataTable :caption="$t(`cms.kindsPlural.${store.listKind}`)" :columns="columns" :rows="data?.data" :row-key="(row) => row.id" :loading="pending">
      <template #cell-title="{ row }"><span class="font-medium">{{ row.title }}</span><span class="block text-xs text-slate-500">/{{ row.slug }}</span></template>
      <template #cell-status="{ row }"><Badge :tone="TONE[row.status]">{{ $t(`cms.status.${row.status}`) }}</Badge></template>
      <template #cell-updatedAt="{ row }">{{ row.updatedAt ? formatDateTime(row.updatedAt, locale) : "—" }}</template>
      <template #cell-actions="{ row }">
        <!-- Íconos de 36 px: columna de ancho fijo aunque cambie el idioma o el número de acciones -->
        <div class="flex justify-end gap-1.5">
          <ActionButton :disabled="row.status !== 'PUBLISHED'" icon="view" :label="`${$t('cms.viewPublic')} ${row.title}`" :to="publicUrl(row)" />
          <ActionButton icon="edit" :label="`${$t('common.edit')} ${row.title}`" :to="editUrl(row)" />
          <ActionButton :disabled="row.status === 'ARCHIVED'" icon="archive" :label="`${$t('cms.archive')} ${row.title}`" @click="archive(row)" />
        </div>
      </template>
    </DataTable>
    <Pagination :meta="data?.meta" @page="page = $event" />
  </div>
</template>
