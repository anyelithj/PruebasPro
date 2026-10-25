<!--
  ProductUgc.vue (feature product · Vue 3 + Tailwind) => RF-19.11 contenido generado por usuarios en la ficha:
  galería de fotos/videos aprobados (de clientes o menciones de Instagram, con crédito al autor) y formulario para que
  un cliente con sesión comparta el suyo (sube a /media/upload y queda en moderación).
  Lectura anónima (ISR) y escritura con token. Accesibilidad: alt con autor, <details> nativo, aria-live.
-->
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { useAuth } from "~~/shared/composable/useAuth";
import { useToast } from "~~/shared/composable/useToast";
import { socialApi } from "~~/features/social-commerce/api/social.api";

const props = defineProps<{ productId: string }>();
const { t } = useI18n();
const toast = useToast();
const { isAuthenticated } = useAuth();
const publicApi = socialApi(useApi({ anonymous: true }));
const api = useApi();
const social = socialApi(api);
const { data: items } = await useAsyncData(`ugc:${props.productId}`, () => publicApi.ugc(props.productId).catch(() => []));

const caption = ref("");
const sending = ref(false);
async function share(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  sending.value = true;
  try {
    const body = new FormData();
    body.append("files", file);
    body.append("folder", "ugc");
    const [asset] = (await api.post<Array<{ url: string }>>("/media/upload", body)).data;
    if (!asset) throw new Error(t("error.generic"));
    await social.submitUgc({ productId: props.productId, mediaUrl: asset.url, mediaType: file.type.startsWith("video") ? "VIDEO" : "IMAGE", caption: caption.value });
    toast.success(t("store.ugc.sent"));
    caption.value = "";
  } catch (error) {
    toast.error((error as Error).message);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section aria-labelledby="ugc-title" class="flex flex-col gap-4 border-t pt-8">
    <h2 id="ugc-title" class="text-2xl font-semibold">{{ $t("store.ugc.title") }}</h2>
    <ul v-if="items?.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <li v-for="item in items" :key="item.id" class="flex flex-col gap-1">
        <video v-if="item.mediaType === 'VIDEO'" :src="item.mediaUrl" controls preload="metadata" class="aspect-square w-full rounded-lg object-cover" />
        <img v-else :src="item.mediaUrl" :alt="item.caption || $t('store.ugc.photoBy', { author: item.author })" loading="lazy" width="300" height="300" class="aspect-square w-full rounded-lg object-cover" >
        <a v-if="item.permalink" :href="item.permalink" target="_blank" rel="noopener" class="text-xs text-slate-600 hover:underline">{{ item.author }}</a>
        <span v-else class="text-xs text-slate-600">{{ item.author }}</span>
      </li>
    </ul>
    <p v-else class="text-sm text-slate-600">{{ $t("store.ugc.empty") }}</p>
    <details v-if="isAuthenticated" class="rounded-lg border p-3">
      <summary class="cursor-pointer text-sm font-medium">{{ $t("store.ugc.share") }}</summary>
      <div class="mt-3 flex flex-col gap-2">
        <label class="flex flex-col gap-1 text-sm">{{ $t("store.ugc.caption") }}
          <input v-model="caption" maxlength="1000" class="h-9 rounded-md border px-2" >
        </label>
        <label class="flex flex-col gap-1 text-sm">{{ $t("store.ugc.file") }}
          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" :disabled="sending" class="text-sm" @change="share" >
        </label>
        <p aria-live="polite" class="text-xs text-slate-500">{{ sending ? $t("store.ugc.uploading") : $t("store.ugc.moderation") }}</p>
      </div>
    </details>
  </section>
</template>
