<!--
  CollectionForm.vue (Vue 3 + Vee-Validate + Zod) => crear/editar una colección del catálogo (Express /collection,
  PostgreSQL): nombre, slug, descripción, imagen de portada (Cloudinary), vigencia y productos. Un solo formulario
  para /new y /[slug]/edit (DRY). Patrón Adapter (formulario <-> CreateCollectionSchema de Express).
-->
<script setup lang="ts">
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import type { CatalogCollection } from "~~/entities/cms/model/cms.types";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import { cmsApi } from "../api/cms.api";
import { useCmsStore } from "../model/cms.store";
import { collectionSchema, slugify } from "../lib/cms.validator";
import CollectionBanner from "./CollectionBanner.vue";
import ProductPicker from "./ProductPicker.vue";

const props = defineProps<{ collection?: CatalogCollection | null }>();
const { t } = useI18n();
const toast = useToast();
const localePath = useLocalePath();
const api = cmsApi(useApi());
const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

const { handleSubmit, isSubmitting, values, setFieldValue } = useForm({
  validationSchema: toTypedSchema(collectionSchema),
  initialValues: {
    name: props.collection?.name ?? "",
    slug: props.collection?.slug ?? "",
    description: props.collection?.description ?? "",
    imageUrl: props.collection?.imageUrl ?? "",
    startsAt: toDateInput(props.collection?.startsAt),
    endsAt: toDateInput(props.collection?.endsAt),
    lookDiscountPercent: props.collection?.lookDiscountPercent ?? null,
    isActive: props.collection?.isActive ?? true,
  },
});
const productIds = ref<string[]>(props.collection?.products?.map((product) => product.id) ?? []);
const uploading = ref(false);

// Slug derivado del nombre al crear (mientras el usuario no lo cambie a mano)
watch(
  () => values.name,
  (name, previous) => {
    if (!props.collection && (values.slug ?? "") === slugify(previous ?? "")) setFieldValue("slug", slugify(name ?? ""));
  }
);

const upload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const asset = await api.uploadImage(file);
    if (asset) setFieldValue("imageUrl", asset.url);
  } catch {
    toast.error(t("cms.media.uploadError"));
  } finally {
    uploading.value = false;
  }
};

const save = handleSubmit(async (form) => {
  const payload = { ...form, productIds: productIds.value };
  try {
    if (props.collection) await api.updateCollection(props.collection.id, payload);
    else await api.createCollection(payload);
    toast.success(t("cms.saved"));
    useCmsStore().setListKind("collection"); // Vuelve al listado único del CMS en la pestaña Colecciones
    await navigateTo(localePath(routes.cmsPages));
  } catch (error) {
    toast.error((error as Error).message);
  }
});
</script>

<template>
  <form class="grid grid-cols-1 gap-6 lg:grid-cols-2" novalidate @submit.prevent="save">
    <div class="flex flex-col gap-4">
      <Input name="name" :label="$t('cms.fields.name')" />
      <Input name="slug" :label="$t('cms.fields.slug')" :hint="$t('cms.fields.slugHint')" />
      <Input name="description" as="textarea" :label="$t('cms.fields.description')" />
      <div class="grid grid-cols-2 gap-3">
        <Input name="startsAt" type="date" :label="$t('cms.fields.startsAt')" />
        <Input name="endsAt" type="date" :label="$t('cms.fields.endsAt')" />
      </div>
      <Input name="lookDiscountPercent" type="number" :label="$t('cms.fields.lookDiscount')" :hint="$t('cms.fields.lookDiscountHint')" />
      <Input name="isActive" as="checkbox" :label="$t('cms.fields.active')" />
      <label class="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-dashed text-sm hover:bg-slate-50 focus-within:ring-2 focus-within:ring-accent">
        {{ uploading ? $t("cms.media.uploading") : $t("cms.media.cover") }}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="sr-only" :disabled="uploading" @change="upload" >
      </label>
      <Input name="imageUrl" type="url" :label="$t('cms.fields.imageUrl')" />
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold">{{ $t("cms.products.title") }}</h2>
        <ProductPicker v-model="productIds" />
      </section>
      <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("common.save") }}</Button>
    </div>
    <!-- Vista previa del banner con los valores actuales (reactiva) -->
    <aside class="flex flex-col gap-2" :aria-label="$t('cms.toolbar.preview')">
      <CollectionBanner :collection="{ name: values.name || $t('cms.fields.name'), description: values.description ?? null, imageUrl: values.imageUrl || null, startsAt: values.startsAt || null, endsAt: values.endsAt || null, productCount: productIds.length, lookDiscountPercent: values.lookDiscountPercent || null }" />
    </aside>
  </form>
</template>
