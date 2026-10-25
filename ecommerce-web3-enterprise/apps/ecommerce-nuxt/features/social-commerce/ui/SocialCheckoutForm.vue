<!--
  SocialCheckoutForm.vue (Vue 3 + Vee-Validate + Zod) => genera enlaces de COMPRA SOCIAL: producto + red + campaña +
  código de referido => URL de la tienda con UTM. La compra real ocurre en el checkout de Next.js (un solo checkout:
  sin duplicar pagos ni stock) y la venta queda atribuida a la red/influencer por analytics (channel = utm_source).
  Patrón Factory (enlace a partir del formulario) + Clipboard API nativa.
-->
<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useToast } from "~~/shared/composable/useToast";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import ProductPicker from "~~/features/cms/ui/ProductPicker.vue";
import type { ProductCard } from "~~/shared/types/common.types";
import { buildCheckoutUrl, checkoutLinkSchema, PLATFORMS } from "../lib/social.validator";
import { useSocialStore } from "../model/social.store";

const { t } = useI18n();
const toast = useToast();
const store = useSocialStore();
const runtime = useRuntimeConfig();
const shopUrl = `${runtime.public.siteUrl}${runtime.app.baseURL.replace(/\/$/, "")}`; // Tienda (Nuxt): enlace compartible a la ficha
const product = ref<ProductCard | null>(null);
const { handleSubmit, isSubmitting, setFieldValue } = useForm({
  validationSchema: toTypedSchema(checkoutLinkSchema),
  initialValues: { productId: "", platform: "INSTAGRAM", campaign: "", referralCode: "" },
});

const pick = (selected: ProductCard) => {
  product.value = selected;
  setFieldValue("productId", selected.id);
};

const submit = handleSubmit(async (values) => {
  const url = buildCheckoutUrl(shopUrl, values);
  store.addLink(url);
  await navigator.clipboard.writeText(url).then(() => toast.success(t("social.linkCopied")), () => toast.info(url));
});
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">{{ $t("social.checkout.product") }}</h2>
        <p v-if="product" class="rounded-md bg-slate-50 p-2 text-sm">{{ product.name }}</p>
        <ProductPicker single @pick="pick" />
        <Input name="productId" type="hidden" :label="$t('social.checkout.productId')" class="sr-only" />
      </section>
      <Input name="platform" as="select" :label="$t('social.fields.platforms')" :options="PLATFORMS.map((value) => ({ value, label: value }))" />
      <Input name="campaign" :label="$t('social.checkout.campaign')" :hint="$t('social.checkout.campaignHint')" />
      <Input name="referralCode" :label="$t('social.fields.referral')" />
      <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("social.checkout.generate") }}</Button>
    </form>
    <section aria-labelledby="links-title" class="flex flex-col gap-2">
      <h2 id="links-title" class="text-sm font-semibold">{{ $t("social.checkout.links") }}</h2>
      <p v-if="!store.links.length" class="text-sm text-slate-500">{{ $t("social.checkout.empty") }}</p>
      <ul class="flex flex-col gap-2">
        <li v-for="link in store.links" :key="link.url" class="break-all rounded-md border bg-white p-2 text-xs">
          <a :href="link.url" target="_blank" rel="noopener" class="text-accent underline">{{ link.url }}</a>
        </li>
      </ul>
    </section>
  </div>
</template>
