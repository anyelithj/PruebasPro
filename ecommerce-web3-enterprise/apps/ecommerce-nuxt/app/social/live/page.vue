<!--
  page.vue (/social/live) => RF-19.9 Live Shopping (Guard ADMIN/VENDOR): programar una transmisión en varias redes a la
  vez (YouTube, Facebook, Instagram, TikTok) con su reproductor embebido para la tienda, elegir los productos, iniciar /
  terminar y FIJAR en vivo el producto que se está mostrando (los espectadores lo ven al instante).
  Patrones: Factory (formulario Vee-Validate + Zod) + State (SCHEDULED -> LIVE -> ENDED) + Command (acciones de fila).
-->
<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import AdminHeading from "~~/shared/ui/AdminHeading.vue";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import Badge from "~~/shared/ui/Badge.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import ProductPicker from "~~/features/cms/ui/ProductPicker.vue";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { formatDateTime } from "~~/shared/lib/format";
import { routes } from "~~/shared/constants/routes";
import { socialApi } from "~~/features/social-commerce/api/social.api";
import { liveSchema, toLivePayload } from "~~/features/social-commerce/lib/social.validator";
import type { LiveSession } from "~~/entities/social/model/social.types";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });

const { t, locale } = useI18n();
const toast = useToast();
const localePath = useLocalePath();
const api = socialApi(useApi());
const { data: lives, refresh } = useAsyncData("admin-lives", () => api.lives().catch(() => [] as LiveSession[]), { server: false });
const productIds = ref<string[]>([]);
const TONE = { SCHEDULED: "info", LIVE: "danger", ENDED: "neutral" } as const;

const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(liveSchema),
  initialValues: { title: "", description: "", embedUrl: "", youtubeUrl: "", facebookUrl: "", instagramUrl: "", tiktokUrl: "", scheduledAt: "" },
});
const create = handleSubmit(async (values) => {
  try {
    await api.createLive(toLivePayload(values, productIds.value));
    toast.success(t("social.live.created"));
    resetForm();
    productIds.value = [];
    await refresh();
  } catch (error) {
    toast.error((error as Error).message);
  }
});

// act => cambio de estado o producto fijado; Express valida la transición y emite el evento a los espectadores
async function act(live: LiveSession, body: Record<string, unknown>, message: string) {
  try {
    await api.updateLive(live.id, body);
    toast.success(message);
    await refresh();
  } catch (error) {
    toast.error((error as Error).message);
  }
}
async function remove(live: LiveSession) {
  await api.deleteLive(live.id).catch((error: Error) => toast.error(error.message));
  await refresh();
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <AdminHeading nav-key="liveShopping" />
    <section aria-labelledby="live-new" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
      <h2 id="live-new" class="text-lg font-semibold">{{ $t("social.live.new") }}</h2>
      <form class="flex flex-col gap-3" novalidate @submit.prevent="create">
        <Input name="title" :label="$t('social.live.fields.title')" />
        <Input name="description" as="textarea" :rows="3" :label="$t('social.live.fields.description')" />
        <Input name="embedUrl" type="url" :label="$t('social.live.fields.embedUrl')" :hint="$t('social.live.fields.embedHint')" />
        <fieldset class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend class="text-sm font-medium">{{ $t("social.live.fields.streams") }}</legend>
          <Input name="youtubeUrl" type="url" label="YouTube" />
          <Input name="facebookUrl" type="url" label="Facebook" />
          <Input name="instagramUrl" type="url" label="Instagram" />
          <Input name="tiktokUrl" type="url" label="TikTok" />
        </fieldset>
        <Input name="scheduledAt" type="datetime-local" :label="$t('social.live.fields.scheduledAt')" />
        <section class="flex flex-col gap-2">
          <h3 class="text-sm font-medium">{{ $t("cms.products.title") }}</h3>
          <ProductPicker v-model="productIds" />
        </section>
        <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("social.live.create") }}</Button>
      </form>
    </section>

    <section aria-labelledby="live-list" class="flex flex-col gap-3">
      <h2 id="live-list" class="text-lg font-semibold">{{ $t("social.live.list") }}</h2>
      <EmptyState v-if="!(lives ?? []).length" :title="$t('social.live.empty')" />
      <ul v-else class="flex flex-col gap-3">
        <li v-for="live in lives ?? []" :key="live.id" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold">{{ live.title }} <Badge :tone="TONE[live.status]">{{ $t(`social.live.statuses.${live.status}`) }}</Badge></p>
            <div class="flex gap-2">
              <ActionButton icon="open" :label="`${$t('social.live.view')} ${live.title}`" :to="localePath(routes.live(live.id))" />
              <ActionButton :disabled="live.status !== 'SCHEDULED'" icon="play" :label="`${$t('social.live.start')} ${live.title}`" @click="act(live, { status: 'LIVE' }, $t('social.live.started'))" />
              <ActionButton :disabled="live.status === 'ENDED'" icon="close" :label="`${$t('social.live.end')} ${live.title}`" @click="act(live, { status: 'ENDED' }, $t('social.live.ended'))" />
              <ActionButton icon="delete" :label="`${$t('common.delete')} ${live.title}`" @click="remove(live)" />
            </div>
          </div>
          <p class="text-xs text-slate-500">{{ formatDateTime(live.scheduledAt, locale) }} · {{ live.streams.map((s) => s.platform).join(", ") || "STORE" }} · {{ $t("social.live.clicks", { n: live.clicks }) }}</p>
          <fieldset v-if="live.status !== 'ENDED' && live.products.length" class="flex flex-wrap gap-2">
            <legend class="mb-1 text-sm font-medium">{{ $t("social.live.pin") }}</legend>
            <Button
              v-for="product in live.products"
              :key="product.id"
              size="sm"
              :variant="live.pinnedProductId === product.id ? 'primary' : 'secondary'"
              :aria-pressed="live.pinnedProductId === product.id"
              @click="act(live, { pinnedProductId: product.id }, $t('social.live.pinned', { name: product.name }))"
            >
              📌 {{ product.name }}
            </Button>
          </fieldset>
        </li>
      </ul>
    </section>
  </div>
</template>
