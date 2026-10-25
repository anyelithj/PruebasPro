<!--
  OfflineIndicator.vue (Vue 3 + VueUse useOnline + mensajes del Service Worker) => aviso cuando se pierde la conexión
  (lo que está en caché sigue funcionando) y, RF-28.4, cuántas acciones hechas sin conexión esperan enviarse; al
  volver la red pide al SW reenviarlas (respaldo de navegadores sin Background Sync) y confirma la sincronización.
  Observer de online/offline y de "message" del SW (sin sondeos). role="status" => el lector lo anuncia sin interrumpir.
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useOnline } from "@vueuse/core";

const online = useOnline();
const pending = ref(0);
const synced = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

// onMessage => el SW informa la cola: OUTBOX_PENDING (n acciones) / OUTBOX_SYNCED (enviadas)
function onMessage(event: MessageEvent<{ type?: string; count?: number }>) {
  if (event.data?.type === "OUTBOX_PENDING") pending.value = event.data.count ?? pending.value + 1;
  if (event.data?.type === "OUTBOX_SYNCED") {
    pending.value = 0;
    synced.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (synced.value = false), 4000);
  }
}

onMounted(() => navigator.serviceWorker?.addEventListener("message", onMessage));
onBeforeUnmount(() => {
  navigator.serviceWorker?.removeEventListener("message", onMessage);
  clearTimeout(timer);
});
// Al recuperar la conexión: pide reenviar la cola (Safari/Firefox no tienen el evento "sync")
watch(online, (isOnline) => {
  if (isOnline && pending.value > 0) navigator.serviceWorker?.controller?.postMessage({ type: "REPLAY_OUTBOX" });
});
</script>

<template>
  <p v-if="!online || pending > 0" role="status" class="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 shadow">
    <span aria-hidden="true">⚡</span> {{ !online ? $t("pwa.offline.banner") : "" }}
    <span v-if="pending > 0"> {{ $t("pwa.offline.pending", { n: pending }) }}</span>
  </p>
  <p v-else-if="synced" role="status" class="rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-900 shadow">✓ {{ $t("pwa.offline.synced") }}</p>
</template>
