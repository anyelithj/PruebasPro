<!--
  ProductPromo.vue (feature product · Vue 3 + VueUse vía useCountdown + Tailwind) => avisos comerciales de la ficha:
   - RF-13.8 oferta flash vigente con contador regresivo (se consulta en el navegador: la página ISR no se desactualiza)
   - RF-14.4 preventa exclusiva para los niveles Diamante y Platino
   - RF-14.1 compartir en redes (Web Share API nativa o enlaces) y sumar puntos de fidelidad con sesión
  Accesibilidad: role="timer" con etiqueta de la fecha completa (el texto que cambia cada segundo es aria-hidden).
-->
<script setup lang="ts">
import { computed } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { useAuth } from "~~/shared/composable/useAuth";
import { useToast } from "~~/shared/composable/useToast";
import { useCountdown } from "~~/shared/composable/useCountdown";
import { formatDate, formatDateTime } from "~~/shared/lib/format";

const props = defineProps<{ productId: string; name: string; preSaleUntil?: string | null }>();
const { locale, t } = useI18n();
const toast = useToast();
const { isAuthenticated } = useAuth();
const api = useApi();

// server: false => la oferta se pide en el cliente (cambia cada minuto; el HTML cacheado por ISR no la congela)
const { data: flash } = useAsyncData(`flash:${props.productId}`, () => api.get<Array<{ name: string; percent: number | null; endsAt: string }>>("/promotion/flash", { productId: props.productId }).then((r) => r.data[0] ?? null).catch(() => null), { server: false });
const remaining = useCountdown(() => flash.value?.endsAt);
const isPreSale = computed(() => Boolean(props.preSaleUntil && new Date(props.preSaleUntil) > new Date()));

// "as const" => redes válidas = mismo enum que ShareSchema de Express
const NETWORKS = [
  { id: "whatsapp", label: "WhatsApp", url: (link: string, text: string) => `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}` },
  { id: "facebook", label: "Facebook", url: (link: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  { id: "x", label: "X", url: (link: string, text: string) => `https://x.com/intent/post?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}` },
  { id: "pinterest", label: "Pinterest", url: (link: string, text: string) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(link)}&description=${encodeURIComponent(text)}` },
] as const;

function share(network: (typeof NETWORKS)[number]) {
  const link = window.location.href;
  window.open(network.url(link, props.name), "_blank", "noopener,width=600,height=500");
  // Puntos por compartir (RF-14.1): el backend limita cuántas veces al día suma
  if (isAuthenticated.value) api.post<{ awarded: boolean; points: number }>("/loyalty/me/share", { productId: props.productId, network: network.id }).then(({ data }) => data?.awarded && toast.success(t("store.promo.sharePoints", { points: data.points }))).catch(() => undefined);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="flash && !remaining.done" role="timer" :aria-label="$t('store.promo.flashEnds', { name: flash.name, date: formatDateTime(flash.endsAt, locale) })" class="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-red-900">
      <span class="font-semibold">⚡ {{ flash.name }}<template v-if="flash.percent"> · -{{ flash.percent }}%</template></span>
      <span aria-hidden="true" class="font-mono tabular-nums">{{ remaining.days ? `${remaining.days}d ` : "" }}{{ [remaining.hours, remaining.minutes, remaining.seconds].map((n) => String(n).padStart(2, "0")).join(":") }}</span>
    </div>
    <p v-if="isPreSale && preSaleUntil" class="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">💎 {{ $t("store.promo.preSale", { date: formatDate(preSaleUntil, locale) }) }}</p>
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-slate-600">{{ $t("store.promo.share") }}</span>
      <button v-for="network in NETWORKS" :key="network.id" type="button" class="rounded-md border px-2 py-1 hover:bg-slate-50" @click="share(network)">{{ network.label }}</button>
    </div>
  </div>
</template>
