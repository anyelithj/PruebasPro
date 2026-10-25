<!--
  CMSPageEditor.vue (Vue 3 + GrapesJS + Vee-Validate + Zod) => editor de contenido del CMS para los 4 tipos
  (página, landing, evento, lookbook): metadatos y SEO a la izquierda, lienzo drag-and-drop a la derecha, campos
  propios de cada tipo (Strategy por "kind"), imágenes con texto alternativo obligatorio y productos etiquetados.
  Patrones: Facade (useCMSEditor oculta GrapesJS), Adapter (toData/toForm entre formulario y API), Observer
  (cambios sin guardar => aviso al salir). Responsive: en móvil el formulario va arriba y el lienzo abajo.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import type { CmsContent, CmsMedia, ContentKind } from "~~/entities/cms/model/cms.types";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import Modal from "~~/shared/ui/Modal.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue";
import CMSToolbar from "~~/widgets/cms/CMSToolbar.vue";
import { cmsApi } from "../api/cms.api";
import { contentSchema, slugify, toData, type ContentForm } from "../lib/cms.validator";
import { useCMSBlocks } from "../composable/useCMSBlocks";
import { useCMSEditor } from "../composable/useCMSEditor";
import { useCmsStore } from "../model/cms.store";
import CMSPreview from "./CMSPreview.vue";
import LookbookGrid from "./LookbookGrid.vue";
import ProductPicker from "./ProductPicker.vue";

const props = defineProps<{ kind: ContentKind; content?: CmsContent | null }>();
const { t, locale } = useI18n();
const toast = useToast();
const localePath = useLocalePath();
const store = useCmsStore();
const api = cmsApi(useApi());

// toLocalInput => ISO (UTC) -> "YYYY-MM-DDTHH:mm" en hora local para <input type="datetime-local">
const toLocalInput = (iso?: unknown) => (typeof iso === "string" && iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const data = (props.content?.data ?? {}) as Record<string, unknown>;

// initialValues => documento guardado -> valores planos del formulario (Adapter)
const initialValues: ContentForm = {
  kind: props.kind,
  title: props.content?.title ?? "",
  slug: props.content?.slug ?? "",
  summary: props.content?.summary ?? "",
  locale: props.content?.locale ?? (locale.value as "es" | "en"),
  status: props.content?.status ?? "DRAFT",
  seoTitle: props.content?.seo.title ?? "",
  seoDescription: props.content?.seo.description ?? "",
  headline: String(data["headline"] ?? ""),
  ctaLabel: String(data["ctaLabel"] ?? ""),
  ctaUrl: String(data["ctaUrl"] ?? ""),
  couponCode: String(data["couponCode"] ?? ""),
  endsAt: props.kind === "landing" ? toLocalInput(data["endsAt"]) : "",
  startsAt: toLocalInput(data["startsAt"]),
  eventEndsAt: props.kind === "event" ? toLocalInput(data["endsAt"]) : "",
  location: String(data["location"] ?? ""),
  online: data["online"] !== false,
  eventUrl: String(data["url"] ?? ""),
  season: String(data["season"] ?? ""),
};
const { handleSubmit, isSubmitting, values, setFieldValue } = useForm({ validationSchema: toTypedSchema(contentSchema), initialValues });

// Slug automático a partir del título (solo al crear) mientras el slug siga siendo el derivado del título anterior:
// si el usuario lo escribió a mano, ya no se toca
watch(
  () => values.title,
  (title, previous) => {
    if (!props.content && (values.slug ?? "") === slugify(previous ?? "")) setFieldValue("slug", slugify(title ?? ""));
  }
);

// ---------- Lienzo GrapesJS ----------
const canvas = ref<HTMLElement | null>(null);
const editor = useCMSEditor({ container: canvas, blocks: useCMSBlocks(t), project: props.content?.body.project ?? null, html: props.content?.body.html ?? "" });
const previewOpen = ref(false);
const preview = ref({ html: "", css: "" });
const openPreview = () => {
  const snap = editor.snapshot();
  preview.value = { html: snap?.html ?? "", css: snap?.css ?? "" };
  previewOpen.value = true;
};

// ---------- Imágenes (lookbook y portada) y productos ----------
const media = ref<CmsMedia[]>(structuredClone(props.content?.media ?? []));
const productIds = ref<string[]>([...(props.content?.productIds ?? [])]);
const uploading = ref(false);
const tagging = ref<{ index: number; x: number; y: number } | null>(null);

const upload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 5 * 1024 * 1024) return toast.error(t("cms.media.invalid"));
  uploading.value = true;
  try {
    const asset = await api.uploadImage(file);
    if (asset) media.value = [...media.value, { url: asset.url, publicId: asset.publicId, alt: "", width: asset.width, height: asset.height, hotspots: [] }];
    store.markDirty();
  } catch {
    toast.error(t("cms.media.uploadError"));
  } finally {
    uploading.value = false;
  }
};
const removeMedia = (index: number) => (media.value = media.value.filter((_, position) => position !== index));
const addHotspot = (productId: string) => {
  if (!tagging.value) return;
  const { index, x, y } = tagging.value;
  media.value[index]?.hotspots.push({ productId, x, y });
  tagging.value = null;
  store.markDirty();
};
const removeHotspot = (index: number, spot: number) => media.value[index]?.hotspots.splice(spot, 1);

// ---------- Guardar ----------
const saving = computed(() => isSubmitting.value);
// kind => tipo ACTIVO: al crear se elige en el select "Tipo" del MISMO formulario; al editar queda fijo (la API es por tipo)
const kind = computed<ContentKind>(() => values.kind ?? props.kind);
const editUrl = (slug: string) => localePath(`${routes.cmsPageEdit(slug)}?kind=${kind.value}`); // Misma ruta para los 4 tipos
const listUrl = localePath(routes.cmsPages);

const save = handleSubmit(async (form) => {
  if (media.value.some((item) => !item.alt.trim())) return toast.error(t("cms.media.altRequired"));
  const body = editor.snapshot();
  const payload = {
    slug: form.slug,
    title: form.title,
    summary: form.summary ?? "",
    locale: form.locale,
    status: form.status,
    seo: { title: form.seoTitle, description: form.seoDescription, imageUrl: media.value[0]?.url ?? null },
    ...(body ? { body } : {}),
    media: media.value,
    productIds: productIds.value,
    data: toData(form),
  };
  try {
    const saved = props.content ? await api.update(props.kind, props.content.id, payload) : await api.create(form.kind, payload);
    store.markDirty(false);
    toast.success(t("cms.saved"));
    if (!props.content || saved.slug !== props.content.slug) await navigateTo(editUrl(saved.slug), { replace: true });
  } catch (error) {
    toast.error((error as Error).message);
  }
});

// Aviso al salir con cambios sin guardar (Observer de navegación)
onBeforeRouteLeave(() => !store.dirty || window.confirm(t("cms.leave")));

const statusOptions = computed(() => (["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((value) => ({ value, label: t(`cms.status.${value}`) })));
const kindOptions = computed(() => (["page", "landing", "event", "lookbook"] as const).map((value) => ({ value, label: t(`cms.kinds.${value}`) })));
const localeOptions = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];
</script>

<template>
  <!-- Alto fijo dentro del layout del panel (cabecera + menú visibles): el lienzo usa el resto de la ventana -->
  <div class="grid grid-cols-1 overflow-hidden rounded-lg border lg:h-[calc(100dvh-7rem)] lg:min-h-[600px] lg:grid-cols-[380px_1fr]">
    <form class="flex flex-col gap-4 overflow-y-auto border-r bg-white p-4" novalidate @submit.prevent="save">
      <!-- Encabezado con salida: volver al listado (si hay cambios sin guardar, onBeforeRouteLeave pide confirmar) -->
      <div class="flex items-center justify-between gap-2">
        <h1 class="text-lg font-semibold">{{ content ? $t("cms.editTitle", { kind: $t(`cms.kinds.${kind}`) }) : $t("common.new") }}</h1>
        <ActionButton icon="close" :label="$t('common.back')" :to="listUrl" />
      </div>
      <Input v-if="!content" name="kind" as="select" :label="$t('cms.fields.kind')" :options="kindOptions" />
      <Input name="title" :label="$t('cms.fields.title')" />
      <Input name="slug" :label="$t('cms.fields.slug')" :hint="$t('cms.fields.slugHint')" />
      <Input name="summary" as="textarea" :rows="3" :label="$t('cms.fields.summary')" />
      <div class="grid grid-cols-2 gap-3">
        <Input name="status" as="select" :label="$t('cms.fields.status')" :options="statusOptions" />
        <Input name="locale" as="select" :label="$t('cms.fields.locale')" :options="localeOptions" />
      </div>

      <!-- Campos propios del tipo (Strategy por kind) -->
      <fieldset v-if="kind === 'landing'" class="flex flex-col gap-3 rounded-md border p-3">
        <legend class="px-1 text-sm font-semibold">{{ $t("cms.kinds.landing") }}</legend>
        <Input name="headline" :label="$t('cms.fields.headline')" />
        <Input name="ctaLabel" :label="$t('cms.fields.ctaLabel')" />
        <Input name="ctaUrl" :label="$t('cms.fields.ctaUrl')" />
        <Input name="couponCode" :label="$t('cms.fields.couponCode')" />
        <Input name="endsAt" type="datetime-local" :label="$t('cms.fields.offerEnds')" />
      </fieldset>
      <fieldset v-else-if="kind === 'event'" class="flex flex-col gap-3 rounded-md border p-3">
        <legend class="px-1 text-sm font-semibold">{{ $t("cms.kinds.event") }}</legend>
        <Input name="startsAt" type="datetime-local" :label="$t('cms.fields.startsAt')" />
        <Input name="eventEndsAt" type="datetime-local" :label="$t('cms.fields.endsAt')" />
        <Input name="location" :label="$t('cms.fields.location')" />
        <Input name="online" as="checkbox" :label="$t('cms.fields.online')" />
        <Input name="eventUrl" type="url" :label="$t('cms.fields.eventUrl')" />
      </fieldset>
      <Input v-else-if="kind === 'lookbook'" name="season" :label="$t('cms.fields.season')" />

      <fieldset class="flex flex-col gap-3 rounded-md border p-3">
        <legend class="px-1 text-sm font-semibold">SEO</legend>
        <Input name="seoTitle" :label="$t('cms.fields.seoTitle')" :hint="$t('cms.fields.seoTitleHint')" />
        <Input name="seoDescription" as="textarea" :rows="2" :label="$t('cms.fields.seoDescription')" :hint="$t('cms.fields.seoDescriptionHint')" />
      </fieldset>

      <!-- Imágenes: la primera es la portada (tarjetas y Open Graph); en lookbooks, galería con productos -->
      <fieldset class="flex flex-col gap-3 rounded-md border p-3">
        <legend class="px-1 text-sm font-semibold">{{ $t("cms.media.title") }}</legend>
        <label class="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-dashed text-sm hover:bg-slate-50 focus-within:ring-2 focus-within:ring-accent">
          {{ uploading ? $t("cms.media.uploading") : $t("cms.media.upload") }}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="sr-only" :disabled="uploading" @change="upload" >
        </label>
        <ul class="flex flex-col gap-2">
          <li v-for="(item, index) in media" :key="item.url" class="flex gap-2">
            <img :src="item.url" alt="" width="56" height="56" class="size-14 rounded object-cover" >
            <label class="flex flex-1 flex-col gap-1 text-xs">
              {{ $t("cms.media.alt") }}
              <input v-model="item.alt" class="h-9 rounded-md border border-slate-300 px-2 text-sm" :aria-invalid="!item.alt.trim() || undefined" required >
            </label>
            <ActionButton icon="delete" class="self-end" :label="$t('common.delete')" @click="removeMedia(index)" />
          </li>
        </ul>
        <p v-if="kind === 'lookbook' && media.length" class="text-xs text-slate-500">{{ $t("cms.lookbook.tagHint") }}</p>
      </fieldset>

      <fieldset v-if="kind !== 'page'" class="flex flex-col gap-2 rounded-md border p-3">
        <legend class="px-1 text-sm font-semibold">{{ $t("cms.products.title") }}</legend>
        <ProductPicker v-model="productIds" />
      </fieldset>

      <Button type="submit" class="self-end" :loading="saving">{{ $t("common.save") }}</Button>
    </form>

    <section class="flex min-h-[60vh] flex-col" :aria-label="$t('cms.canvas')">
      <CMSToolbar :saving="saving" @device="editor.setDevice" @undo="editor.undo" @redo="editor.redo" @preview="openPreview" @save="save" />
      <div v-if="kind === 'lookbook' && media.length" class="max-h-[40vh] overflow-y-auto border-b bg-white p-3">
        <LookbookGrid :media="media" editable @tag="(index, x, y) => (tagging = { index, x, y })" @untag="removeHotspot" />
      </div>
      <div ref="canvas" class="min-h-0 flex-1" />
    </section>

    <Modal :open="previewOpen" :title="$t('cms.toolbar.preview')" @update:open="previewOpen = $event">
      <CMSPreview :html="preview.html" :css="preview.css" :title="values.title ?? ''" />
    </Modal>
    <Modal :open="tagging !== null" :title="$t('cms.lookbook.tagTitle')" @update:open="!$event && (tagging = null)">
      <ProductPicker single @pick="(product) => addHotspot(product.id)" />
    </Modal>
  </div>
</template>
