<!--
  page.vue (/social/channels) => comercio multicanal (Guard ADMIN):
   - RF-19.1 / 19.7 / 19.10 estado del catálogo en Meta (Facebook Shop, Instagram, Marketplace y WhatsApp) y TikTok
     Shop: SKU publicadas, errores, última sincronización y botón "Sincronizar ahora" (también corre cada hora)
   - RF-19.3 recordatorio de los webhooks de pedidos nativos (se importan como pedidos normales de la tienda)
   - RF-19.11 moderación del contenido de clientes (UGC) e importación de menciones de Instagram
  Patrones: Facade (socialApi) + Command (sincronizar, aprobar, rechazar). Accesibilidad: tabla con caption, estados
  con texto (no solo color), aria-live en los resultados.
-->
<script setup lang="ts">
import { ref } from "vue";
import AdminHeading from "~~/shared/ui/AdminHeading.vue";
import Button from "~~/shared/ui/Button.vue";
import Badge from "~~/shared/ui/Badge.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import ProductPicker from "~~/features/cms/ui/ProductPicker.vue";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { formatDateTime } from "~~/shared/lib/format";
import { socialApi } from "~~/features/social-commerce/api/social.api";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });

const { t, locale } = useI18n();
const toast = useToast();
const api = socialApi(useApi());
const { data: channels, refresh: refreshChannels } = useAsyncData("social-channels", () => api.channels().catch(() => []), { server: false });
const status = ref<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
const { data: queue, refresh: refreshQueue } = useAsyncData("ugc-queue", async () => (await api.ugcQueue({ status: status.value, limit: 50 })).data, { server: false, watch: [status] });

const syncing = ref(false);
async function sync() {
  syncing.value = true;
  try {
    const result = await api.syncChannels();
    toast.success(result.length ? result.map((row) => t("social.channels.syncResult", { channel: t(`social.channels.names.${row.channel}`), synced: row.synced, failed: row.failed })).join(" · ") : t("social.channels.noneConfigured"));
    await refreshChannels();
  } catch (error) {
    toast.error((error as Error).message);
  } finally {
    syncing.value = false;
  }
}

async function moderate(id: string, next: "APPROVED" | "REJECTED") {
  try {
    await api.moderateUgc(id, next);
    toast.success(t(`social.ugc.${next === "APPROVED" ? "approved" : "rejected"}`));
    await refreshQueue();
  } catch (error) {
    toast.error((error as Error).message);
  }
}

// Importación de menciones de Instagram para un producto (opcionalmente filtradas por hashtag)
const importProduct = ref<string[]>([]);
const hashtag = ref("");
async function importMentions() {
  const productId = importProduct.value[0];
  if (!productId) return toast.info(t("social.ugc.pickProduct"));
  try {
    const { imported } = await api.importUgc(productId, hashtag.value.replace(/^#/, "") || undefined);
    toast.success(t("social.ugc.imported", { count: imported }));
    await refreshQueue();
  } catch (error) {
    toast.error((error as Error).message);
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <AdminHeading nav-key="socialChannels" />

    <section aria-labelledby="channels-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id="channels-title" class="text-lg font-semibold">{{ $t("social.channels.title") }}</h2>
        <Button :loading="syncing" @click="sync">{{ $t("social.channels.sync") }}</Button>
      </div>
      <p class="text-sm text-slate-600">{{ $t("social.channels.hint") }}</p>
      <table class="w-full text-sm">
        <caption class="sr-only">{{ $t("social.channels.title") }}</caption>
        <thead class="border-b text-left text-slate-600">
          <tr><th scope="col" class="py-2">{{ $t("social.channels.channel") }}</th><th scope="col">{{ $t("social.channels.state") }}</th><th scope="col" class="text-right">{{ $t("social.channels.listed") }}</th><th scope="col" class="text-right">{{ $t("social.channels.errors") }}</th><th scope="col">{{ $t("social.channels.lastSync") }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in channels ?? []" :key="row.channel" class="border-b last:border-0">
            <td class="py-2"><span class="font-medium">{{ $t(`social.channels.names.${row.channel}`) }}</span><br><span class="text-xs text-slate-500">{{ $t(`social.channels.covers.${row.channel}`) }}</span></td>
            <td><Badge :tone="row.configured ? 'success' : 'neutral'">{{ row.configured ? $t("social.channels.configured") : $t("social.channels.notConfigured") }}</Badge></td>
            <td class="text-right tabular-nums">{{ row.listed }}</td>
            <td class="text-right tabular-nums" :class="row.errors ? 'text-red-700' : ''">{{ row.errors }}</td>
            <td>{{ row.lastSync ? formatDateTime(row.lastSync, locale) : "—" }}</td>
          </tr>
        </tbody>
      </table>
      <p class="text-xs text-slate-500">{{ $t("social.channels.ordersHint") }}</p>
    </section>

    <section aria-labelledby="ugc-title" class="flex flex-col gap-4 rounded-xl border bg-white p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ugc-title" class="text-lg font-semibold">{{ $t("social.ugc.title") }}</h2>
        <label class="flex items-center gap-2 text-sm">{{ $t("social.ugc.status") }}
          <select v-model="status" class="h-9 rounded-md border border-slate-300 px-3 text-sm">
            <option v-for="value in ['PENDING', 'APPROVED', 'REJECTED']" :key="value" :value="value">{{ $t(`social.ugc.statuses.${value}`) }}</option>
          </select>
        </label>
      </div>
      <details class="rounded-md border p-3">
        <summary class="cursor-pointer text-sm font-medium">{{ $t("social.ugc.importTitle") }}</summary>
        <div class="mt-3 flex flex-col gap-3">
          <ProductPicker v-model="importProduct" single />
          <label class="flex flex-col gap-1 text-sm">{{ $t("social.ugc.hashtag") }}
            <input v-model="hashtag" class="h-9 rounded-md border border-slate-300 px-3 text-sm" placeholder="#mitienda" >
          </label>
          <Button class="self-end" @click="importMentions">{{ $t("social.ugc.import") }}</Button>
        </div>
      </details>
      <EmptyState v-if="!(queue ?? []).length" :title="$t('social.ugc.empty')" />
      <ul v-else class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <li v-for="item in queue ?? []" :key="item.id" class="flex flex-col gap-2 rounded-lg border p-2 text-sm">
          <video v-if="item.mediaType === 'VIDEO'" :src="item.mediaUrl" controls preload="metadata" class="aspect-square w-full rounded object-cover" />
          <img v-else :src="item.mediaUrl" :alt="item.caption || $t('social.ugc.photoBy', { author: item.author })" loading="lazy" class="aspect-square w-full rounded object-cover" >
          <p class="font-medium">{{ item.author }} · {{ $t(`social.ugc.sources.${item.source}`) }}</p>
          <p class="line-clamp-2 text-xs text-slate-600">{{ item.caption }}</p>
          <!-- Acciones siempre visibles (como en Next): bloqueadas si la mención ya fue moderada -->
          <div class="mt-auto flex justify-end gap-1.5">
            <ActionButton :disabled="item.status === 'APPROVED'" icon="check" :label="`${$t('social.ugc.approve')} ${item.author}`" @click="moderate(item.id, 'APPROVED')" />
            <ActionButton :disabled="item.status === 'REJECTED'" icon="delete" :label="`${$t('social.ugc.reject')} ${item.author}`" @click="moderate(item.id, 'REJECTED')" />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
