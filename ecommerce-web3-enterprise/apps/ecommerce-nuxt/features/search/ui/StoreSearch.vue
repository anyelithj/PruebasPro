<!--
  StoreSearch.vue (Vue 3 + Nuxt + Tailwind) => buscador de la tienda (RF-06.1 / RF-06.2):
  - Texto con AUTOCOMPLETADO: <datalist> nativo alimentado por GET /search/suggestions (sin librería; funciona con
    teclado y lector de pantalla). Sin JavaScript sigue siendo un <form method="get"> hacia /products?q=.
  - VOZ: Web Speech API del navegador (SpeechRecognition); el botón solo aparece si el navegador la soporta.
  - QR / CÓDIGO DE BARRAS: BarcodeDetector nativo sobre una foto de la cámara (input capture). Un enlace de la tienda
    abre esa página; cualquier otro código (SKU, EAN) se busca como texto.
  - IMAGEN: enlace a /search (búsqueda visual con IA, RF-06.4).
  Patrones: Facade (useApi), Observer (watch + debounce), detección de capacidades (Progressive Enhancement).
  Diseño ÚNICO: mismo marcado, clases e íconos SVG (manifiesto admin-nav.json) que StoreSearch.tsx de Next.js (login y
  registro), así el buscador se ve idéntico en toda la aplicación.
-->
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { useDebounce } from "~~/shared/composable/useDebounce";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import type { AdminNav } from "@ecommerce/shared-types"; // "import type" => solo tipos (0 bytes en el bundle)
import navData from "@ecommerce/shared-types/admin-nav.json"; // Íconos SVG compartidos con Next.js

const ICONS = (navData as AdminNav).icons; // mic, qr, camera, search: los mismos trazos en ambas apps
const props = defineProps<{ id: string; compact?: boolean }>(); // "id" único: el header monta dos (escritorio y móvil)
const route = useRoute();
const localePath = useLocalePath();
const { t, locale } = useI18n();
const toast = useToast();
const api = useApi({ anonymous: true });

const query = ref(typeof route.query.q === "string" ? route.query.q : "");
const suggestions = ref<Array<{ type: string; label: string }>>([]);
const debounced = useDebounce(query, 300);
// Autocompletado: una petición cuando el usuario deja de escribir (2+ letras); los errores no interrumpen la búsqueda
watch(debounced, async (value) => {
  suggestions.value = value.trim().length >= 2 ? ((await api.get<Array<{ type: string; label: string }>>("/search/suggestions", { q: value.trim() }).catch(() => ({ data: [] }))).data ?? []) : [];
});

const search = (text: string) => navigateTo({ path: localePath(routes.products), query: { q: text.trim() } });

// --- Voz (RF-06.2) ---
type Recognition = { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void };
const voiceSupported = ref(false);
const listening = ref(false);
const qrSupported = ref(false);
onMounted(() => {
  const w = window as unknown as Record<string, unknown>;
  voiceSupported.value = Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition); // Chrome/Edge/Safari
  qrSupported.value = "BarcodeDetector" in window; // Chrome/Edge en Android y escritorio
});
function listen() {
  const w = window as unknown as Record<string, new () => Recognition>;
  const RecognitionClass = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!RecognitionClass) return;
  const recognition = new RecognitionClass();
  recognition.lang = locale.value === "en" ? "en-US" : "es-CO";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript ?? "";
    query.value = text;
    if (text) void search(text);
  };
  recognition.onerror = () => toast.error(t("store.search.voiceError"));
  recognition.onend = () => (listening.value = false);
  listening.value = true;
  recognition.start();
}

// --- QR / código de barras (RF-06.2) ---
// toUrl => URL si el texto del código es un enlace válido; null si es un SKU/EAN u otro texto
const toUrl = (text: string): URL | null => {
  try {
    return new URL(text);
  } catch {
    return null;
  }
};
const scanInput = ref<HTMLInputElement | null>(null);
async function onScan(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const Detector = (window as unknown as { BarcodeDetector: new () => { detect: (image: ImageBitmap) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    const [code] = await new Detector().detect(await createImageBitmap(file));
    if (!code) return toast.error(t("store.search.qrNotFound"));
    // Enlace de esta tienda => se abre su ruta; otro texto (SKU, EAN) => búsqueda
    const url = toUrl(code.rawValue);
    if (url && url.origin === window.location.origin) await navigateTo(url.pathname + url.search);
    else await search(code.rawValue);
  } catch {
    toast.error(t("store.search.qrNotFound"));
  } finally {
    (event.target as HTMLInputElement).value = ""; // Permite volver a escanear la misma foto
  }
}
// Clases compartidas con StoreSearch.tsx (Next.js): botón de 32 px dentro de un campo de 40 px
const ICON_BUTTON = "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const FIELD = "h-10 w-full rounded-full border border-slate-300 bg-slate-50 pl-4 pr-36 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent";
</script>

<template>
  <form role="search" method="get" :action="localePath(routes.products)" :class="['relative w-full', props.compact ? '' : 'max-w-md']" @submit.prevent="query.trim() && search(query)">
    <label :for="props.id" class="sr-only">{{ $t("store.search.label") }}</label>
    <input :id="props.id" v-model="query" name="q" type="search" :list="`${props.id}-list`" autocomplete="off" :placeholder="$t('store.search.placeholder')" :class="FIELD" >
    <!-- datalist => sugerencias nativas del navegador (productos, categorías y marcas) -->
    <datalist :id="`${props.id}-list`">
      <option v-for="item in suggestions" :key="`${item.type}-${item.label}`" :value="item.label" />
    </datalist>
    <div class="absolute inset-y-0 right-1 flex items-center">
      <button v-if="voiceSupported" type="button" :class="[ICON_BUTTON, listening && 'animate-pulse bg-red-100 text-red-700']" :aria-label="$t('store.search.voice')" :aria-pressed="listening" @click="listen">
        <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto (repositorio), nunca datos del usuario -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]" aria-hidden="true" v-html="ICONS.mic" />
      </button>
      <template v-if="qrSupported">
        <button type="button" :class="ICON_BUTTON" :aria-label="$t('store.search.qr')" @click="scanInput?.click()">
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]" aria-hidden="true" v-html="ICONS.qr" />
        </button>
        <!-- capture="environment" => en el celular abre la cámara trasera directamente -->
        <input ref="scanInput" type="file" accept="image/*" capture="environment" class="sr-only" tabindex="-1" aria-hidden="true" @change="onScan" >
      </template>
      <NuxtLink :to="localePath(routes.visualSearch)" :class="ICON_BUTTON" :aria-label="$t('store.search.image')" :title="$t('store.search.image')">
        <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]" aria-hidden="true" v-html="ICONS.camera" />
      </NuxtLink>
      <button type="submit" :class="ICON_BUTTON" :aria-label="$t('store.search.submit')" :title="$t('store.search.submit')">
        <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]" aria-hidden="true" v-html="ICONS.search" />
      </button>
    </div>
  </form>
</template>
