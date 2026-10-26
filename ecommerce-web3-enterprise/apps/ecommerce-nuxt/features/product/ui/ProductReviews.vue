<!--
  ProductReviews.vue (feature product · Vue 3 + $fetch vía useApi + Tailwind) => reseñas de la ficha de producto:
   - RF-15.2 promedio por aspecto (calidad, fidelidad, talla, precio) y formulario con fotos y aspectos de 1 a 5
   - RF-15.3 galería de fotos de clientes y botón "¿Te fue útil?" (orden por las más útiles)
   - RF-15.6 marca "editada" con el historial de versiones anteriores (bajo demanda)
  Lecturas ANÓNIMAS (la página usa ISR: la caché compartida nunca guarda datos de un usuario); escrituras con token.
  Patrones: Facade (useApi) + Observer (refresh tras publicar). Accesibilidad: radios nativos por estrella dentro de
  <fieldset>, <details> nativo para el historial, aria-pressed en "útil", aria-live en el estado de subida.
-->
<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useApi, ApiError } from "~~/shared/lib/api-client";
import { useAuth } from "~~/shared/composable/useAuth";
import { useToast } from "~~/shared/composable/useToast";
import { formatDate } from "~~/shared/lib/format";
import { routes } from "~~/shared/constants/routes";

// "const" + "as const" => tupla de solo lectura: los aspectos válidos salen de aquí (mismo contrato que Express)
const ASPECTS = ["quality", "accuracy", "fit", "value"] as const;
type Aspect = (typeof ASPECTS)[number];
type AspectScores = Partial<Record<Aspect, number>>;

interface Review {
  id: string;
  author: { name: string };
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
  vendorReply: string | null;
  createdAt: string;
  photoUrls: string[];
  aspects: AspectScores | null;
  helpfulCount: number;
  edited: boolean;
}
interface Summary { average: number; count: number; aspects: AspectScores; photoCount: number }
interface Photo { reviewId: string; url: string; rating: number; author: string }
interface Revision { rating: number; title: string; body: string; editedAt: string }

// defineProps => contrato tipado del componente (solo necesita el id del producto)
const props = defineProps<{ productId: string }>();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const toast = useToast();
const { isAuthenticated } = useAuth();
const publicApi = useApi({ anonymous: true });
const api = useApi();

const sort = ref<"helpful" | "newest">("helpful");
// useAsyncData => SSR + hidratación (las reseñas también cuentan para SEO); "watch" recarga al cambiar el orden
const { data, refresh } = await useAsyncData(
  `reviews:${props.productId}`,
  async () => {
    const [summary, photos, list] = await Promise.all([
      publicApi.get<Summary>("/review/summary", { productId: props.productId }).then((r) => r.data).catch(() => null),
      publicApi.get<Photo[]>("/review/photos", { productId: props.productId }).then((r) => r.data).catch(() => []),
      publicApi.get<Review[]>("/review", { productId: props.productId, sort: sort.value, limit: 10 }).then((r) => r.data).catch(() => []),
    ]);
    return { summary, photos, list };
  },
  { watch: [sort] }
);

// ---------- RF-15.3 "¿Te fue útil?" (alterna el voto; el contador viene del backend) ----------
const helpful = reactive<Record<string, boolean>>({});
async function toggleHelpful(review: Review) {
  if (!isAuthenticated.value) return toast.info(t("store.reviews.loginToVote"));
  try {
    const { data: result, queued } = await api.post<{ helpful: boolean; helpfulCount: number }>(`/review/${review.id}/helpful`);
    if (queued) return; // RF-28.4 sin conexión: el voto se envía al volver la red
    helpful[review.id] = result.helpful;
    review.helpfulCount = result.helpfulCount; // Mutación local del objeto reactivo (sin recargar la lista)
  } catch (error) {
    toast.error((error as Error).message);
  }
}

// ---------- RF-15.6 historial de versiones (solo se pide al abrir el <details>) ----------
const revisions = reactive<Record<string, Revision[]>>({});
async function loadRevisions(id: string) {
  if (revisions[id]) return;
  revisions[id] = (await publicApi.get<Revision[]>(`/review/${id}/revisions`).catch(() => ({ data: [] }))).data;
}

// ---------- RF-15.2 formulario: calificación, aspectos y fotos ----------
const form = reactive({ rating: 5, title: "", body: "", aspects: {} as AspectScores, photoUrls: [] as string[] });
const uploading = ref(false);
const sending = ref(false);
const canSubmit = computed(() => form.title.trim().length >= 3 && form.body.trim().length >= 10 && !uploading.value);

async function uploadPhotos(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? []).slice(0, 6);
  if (!files.length) return;
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  body.append("folder", "reviews");
  uploading.value = true;
  try {
    form.photoUrls = (await api.post<Array<{ url: string }>>("/media/upload", body)).data.map((asset) => asset.url);
  } catch (error) {
    toast.error((error as Error).message);
  } finally {
    uploading.value = false;
  }
}

async function submit() {
  sending.value = true;
  try {
    await api.post("/review", { productId: props.productId, ...form, aspects: Object.keys(form.aspects).length ? form.aspects : undefined });
    toast.success(t("store.reviews.sent"));
    Object.assign(form, { rating: 5, title: "", body: "", aspects: {}, photoUrls: [] });
    await refresh();
  } catch (error) {
    // 403/409 => sin compra verificada o reseña duplicada: el backend ya envía un mensaje traducido
    toast.error(error instanceof ApiError ? error.message : t("error.generic"));
  } finally {
    sending.value = false;
  }
}

const stars = (value: number) => "★".repeat(Math.round(value)) + "☆".repeat(5 - Math.round(value));
</script>

<template>
  <section aria-labelledby="reviews-title" class="flex flex-col gap-6 border-t pt-8">
    <h2 id="reviews-title" class="text-2xl font-semibold">{{ $t("store.reviews.title") }}</h2>

    <!-- Resumen + promedio por aspecto (barras con texto: no dependen solo del color) -->
    <div v-if="data?.summary && data.summary.count > 0" class="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr]">
      <p class="flex flex-col items-start">
        <span class="text-4xl font-bold tabular-nums">{{ data.summary.average.toFixed(1) }}</span>
        <span aria-hidden="true" class="text-amber-500">{{ stars(data.summary.average) }}</span>
        <span class="text-sm text-slate-600">{{ $t("store.reviews.count", { count: data.summary.count }) }}</span>
      </p>
      <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div v-for="aspect in ASPECTS.filter((key) => data?.summary?.aspects[key])" :key="aspect" class="flex flex-col gap-1">
          <dt class="flex justify-between"><span>{{ $t(`store.reviews.aspects.${aspect}`) }}</span><span class="tabular-nums">{{ data.summary.aspects[aspect]?.toFixed(1) }}/5</span></dt>
          <dd class="h-2 overflow-hidden rounded bg-slate-200"><span class="block h-full bg-amber-500" :style="{ width: `${((data.summary.aspects[aspect] ?? 0) / 5) * 100}%` }" /></dd>
        </div>
      </dl>
    </div>
    <p v-else class="text-sm text-slate-600">{{ $t("store.reviews.empty") }}</p>

    <!-- RF-15.3 galería de fotos de clientes (lazy: no bloquea el LCP de la ficha) -->
    <div v-if="data?.photos.length" class="flex flex-col gap-2">
      <h3 class="font-medium">{{ $t("store.reviews.gallery") }}</h3>
      <ul class="flex gap-2 overflow-x-auto pb-1">
        <li v-for="photo in data.photos" :key="photo.url" class="shrink-0">
          <a :href="photo.url" target="_blank" rel="noopener" class="block size-24 overflow-hidden rounded-md bg-slate-100">
            <img :src="photo.url" :alt="$t('store.reviews.photoAlt', { author: photo.author, rating: photo.rating })" loading="lazy" width="96" height="96" class="size-full object-cover" >
          </a>
        </li>
      </ul>
    </div>

    <!-- Lista ordenable -->
    <div class="flex items-center justify-between gap-2">
      <label for="reviews-sort" class="text-sm font-medium">{{ $t("store.reviews.sortLabel") }}</label>
      <select id="reviews-sort" v-model="sort" class="h-9 rounded-md border border-slate-300 px-3 text-sm">
        <option value="helpful">{{ $t("store.reviews.sortHelpful") }}</option>
        <option value="newest">{{ $t("store.reviews.sortNewest") }}</option>
      </select>
    </div>
    <ul class="flex flex-col gap-4">
      <li v-for="review in data?.list ?? []" :key="review.id" class="flex flex-col gap-2 rounded-lg border border-slate-200 p-4">
        <p class="flex flex-wrap items-center gap-2 text-sm">
          <span aria-hidden="true" class="text-amber-500">{{ stars(review.rating) }}</span>
          <span class="sr-only">{{ $t("store.product.rating", { value: review.rating }) }}</span>
          <strong>{{ review.title }}</strong>
        </p>
        <p class="text-xs text-slate-500">
          {{ review.author.name }} · {{ formatDate(review.createdAt, locale) }}
          <span v-if="review.isVerifiedPurchase"> · ✔ {{ $t("store.reviews.verified") }}</span>
          <span v-if="review.edited"> · {{ $t("store.reviews.edited") }}</span>
        </p>
        <p class="whitespace-pre-line text-sm text-slate-700">{{ review.body }}</p>
        <ul v-if="review.photoUrls.length" class="flex gap-2">
          <li v-for="url in review.photoUrls" :key="url"><img :src="url" alt="" loading="lazy" width="64" height="64" class="size-16 rounded object-cover" ></li>
        </ul>
        <p v-if="review.vendorReply" class="rounded-md bg-slate-50 p-2 text-sm"><strong>{{ $t("store.reviews.vendorReply") }}</strong> {{ review.vendorReply }}</p>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" :aria-pressed="helpful[review.id] ?? false" class="rounded-md border px-2 py-1 hover:bg-slate-50" @click="toggleHelpful(review)">
            👍 {{ $t("store.reviews.helpful", { count: review.helpfulCount }) }}
          </button>
          <details v-if="review.edited" @toggle="loadRevisions(review.id)">
            <summary class="cursor-pointer text-slate-600">{{ $t("store.reviews.history") }}</summary>
            <ol class="mt-2 flex flex-col gap-2 border-l pl-3">
              <li v-for="revision in revisions[review.id] ?? []" :key="revision.editedAt" class="text-xs text-slate-600">
                <span>{{ formatDate(revision.editedAt, locale) }} · {{ stars(revision.rating) }}</span>
                <p><strong>{{ revision.title }}</strong> — {{ revision.body }}</p>
              </li>
            </ol>
          </details>
        </div>
      </li>
    </ul>

    <!-- Formulario (solo con sesión; el backend exige compra verificada) -->
    <form v-if="isAuthenticated" class="flex flex-col gap-3 rounded-lg border border-slate-200 p-4" @submit.prevent="submit">
      <h3 class="font-medium">{{ $t("store.reviews.write") }}</h3>
      <fieldset class="flex flex-wrap items-center gap-2">
        <legend class="text-sm font-medium">{{ $t("store.reviews.rating") }}</legend>
        <label v-for="value in 5" :key="value" class="flex items-center gap-1 text-sm">
          <input v-model.number="form.rating" type="radio" name="rating" :value="value" > {{ value }}★
        </label>
      </fieldset>
      <fieldset class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <legend class="text-sm font-medium">{{ $t("store.reviews.aspectsLegend") }}</legend>
        <label v-for="aspect in ASPECTS" :key="aspect" class="flex items-center justify-between gap-2 text-sm">
          {{ $t(`store.reviews.aspects.${aspect}`) }}
          <select v-model.number="form.aspects[aspect]" class="h-9 rounded-md border border-slate-300 px-3 text-sm">
            <option :value="undefined">—</option>
            <option v-for="value in 5" :key="value" :value="value">{{ value }}</option>
          </select>
        </label>
      </fieldset>
      <label class="flex flex-col gap-1 text-sm">{{ $t("store.reviews.titleField") }}
        <input v-model="form.title" required minlength="3" maxlength="120" class="h-9 rounded-md border border-slate-300 px-3 text-sm" >
      </label>
      <label class="flex flex-col gap-1 text-sm">{{ $t("store.reviews.body") }}
        <textarea v-model="form.body" required minlength="10" maxlength="3000" rows="4" class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label class="flex flex-col gap-1 text-sm">{{ $t("store.reviews.photos") }}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="text-sm" @change="uploadPhotos" >
      </label>
      <p aria-live="polite" class="text-xs text-slate-500">{{ uploading ? $t("store.reviews.uploading") : $t("store.reviews.photosCount", { count: form.photoUrls.length }) }}</p>
      <button type="submit" :disabled="!canSubmit || sending" class="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 disabled:opacity-50">{{ $t("store.reviews.submit") }}</button>
    </form>
    <p v-else class="text-sm"><NuxtLink :to="localePath(routes.login)" class="underline">{{ $t("store.reviews.loginToWrite") }}</NuxtLink></p>
  </section>
</template>
