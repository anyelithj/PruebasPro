<!--
  SocialPublishForm.vue (Vue 3 + Vee-Validate + Zod) => nueva publicación multi-red (Instagram / Facebook / TikTok o
  solo el feed de la tienda): texto, imagen HTTPS con texto alternativo, productos etiquetados, influencer con código
  de referido y programación. Express publica de inmediato, programa o guarda borrador (job de 1 minuto).
  Patrón Factory (formulario a partir del schema) + Adapter (toPayload en social.api).
-->
<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import ProductPicker from "~~/features/cms/ui/ProductPicker.vue";
import { socialApi } from "../api/social.api";
import { PLATFORMS, publishSchema } from "../lib/social.validator";

const emit = defineEmits<{ published: [] }>();
const { t } = useI18n();
const toast = useToast();
const social = socialApi(useApi());
const productIds = ref<string[]>([]);
const { handleSubmit, isSubmitting, values, setFieldValue, resetForm } = useForm({
  validationSchema: toTypedSchema(publishSchema),
  initialValues: { caption: "", mediaUrl: "", mediaAlt: "", platforms: [], influencerHandle: "", influencerName: "", referralCode: "", scheduledAt: "", draft: false, format: "FEED", linkUrl: "" },
});

const togglePlatform = (platform: (typeof PLATFORMS)[number]) => {
  const current = values.platforms ?? [];
  setFieldValue("platforms", current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);
};

const submit = handleSubmit(async (form) => {
  try {
    // productIds vive fuera del formulario (selector de productos) y se envía junto a los valores validados
    await social.publish(form, productIds.value);
    toast.success(form.draft ? t("social.draftSaved") : t("social.published"));
    resetForm();
    productIds.value = [];
    emit("published");
  } catch (error) {
    toast.error((error as Error).message);
  }
});
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <Input name="caption" as="textarea" :label="$t('social.fields.caption')" />
    <Input name="mediaUrl" type="url" :label="$t('social.fields.mediaUrl')" :hint="$t('social.fields.mediaUrlHint')" />
    <Input name="mediaAlt" :label="$t('social.fields.mediaAlt')" />
    <!-- RF-19.8 Story shoppable: imagen vertical 9:16 + enlace de compra (TikTok no admite Stories por API) -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input name="format" as="select" :label="$t('social.fields.format')" :options="[{ value: 'FEED', label: $t('social.formats.FEED') }, { value: 'STORY', label: $t('social.formats.STORY') }]" />
      <Input v-if="values.format === 'STORY'" name="linkUrl" type="url" :label="$t('social.fields.linkUrl')" :hint="$t('social.fields.linkUrlHint')" />
    </div>
    <fieldset class="flex flex-col gap-2">
      <legend class="text-sm font-medium">{{ $t("social.fields.platforms") }}</legend>
      <div class="flex flex-wrap gap-3">
        <label v-for="platform in PLATFORMS" :key="platform" class="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" class="size-4" :checked="values.platforms?.includes(platform)" @change="togglePlatform(platform)" >
          {{ platform }}
        </label>
      </div>
      <p class="text-xs text-slate-500">{{ $t("social.fields.platformsHint") }}</p>
    </fieldset>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Input name="influencerHandle" :label="$t('social.fields.handle')" />
      <Input name="influencerName" :label="$t('social.fields.influencer')" />
      <Input name="referralCode" :label="$t('social.fields.referral')" />
    </div>
    <Input name="scheduledAt" type="datetime-local" :label="$t('social.fields.scheduledAt')" />
    <Input name="draft" as="checkbox" :label="$t('social.fields.draft')" />
    <section class="flex flex-col gap-2">
      <h3 class="text-sm font-medium">{{ $t("cms.products.title") }}</h3>
      <ProductPicker v-model="productIds" />
    </section>
    <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("social.publish") }}</Button>
  </form>
</template>
