<!--
  page.vue (/) => portada de la tienda (Vue 3 SFC + Nuxt 3, SSR + ISR: petición ANÓNIMA, se cachea para todos).
  Secciones: hero con collage de productos reales, franja de beneficios, "para ti" (RF-18.7), lanzamientos,
  categorías (ropa, calzado y accesorios: perfumes, bolsos, relojes, gafas) y programa de fidelidad.
  SEO: useSeoMeta + JSON-LD WebSite/SearchAction (caja de búsqueda en Google). Accesibilidad: cada sección con
  encabezado propio (aria-labelledby), imágenes decorativas con alt="" y animaciones apagadas con motion-reduce.
  Patrones: Container/Presentational (la página reúne datos, ProductGrid/ProductCard solo pintan) + Configuration as
  Data (BENEFITS: agregar un beneficio = una línea, sin tocar el template).
-->
<script setup lang="ts">
// "computed" (Vue Reactivity) => valor derivado que se recalcula solo cuando cambian sus dependencias
import { computed } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { storeApi } from "~~/features/store/api/store.api";
import { routes } from "~~/shared/constants/routes";
import { nextAppUrl } from "~~/shared/constants/config";
import { formatMoney } from "~~/shared/lib/format";
import ProductGrid from "~~/features/product/ui/ProductGrid.vue";
import ForYou from "~~/features/store/ui/ForYou.vue"; // RF-18.7 portada personalizada por historial y contexto

const FEATURED = "lanzamiento"; // Colección destacada en la portada
// BENEFITS => Configuration as Data: clave i18n + trazo SVG 24x24 (contenido estático del repositorio)
const BENEFITS = [
  { key: "shipping", icon: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 18a2 2 0 1 0 0 .01M17 18a2 2 0 1 0 0 .01" },
  { key: "payments", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { key: "rewards", icon: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" },
  { key: "returns", icon: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" },
] as const; // "as const" => tupla de solo lectura con tipos literales (las claves i18n quedan tipadas)

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { storefrontUrl, siteUrl } = useRuntimeConfig().public;
const api = storeApi(useApi({ anonymous: true }));
// "Promise.all" => colección y categorías se piden EN PARALELO; ".catch(() => [])" => si la API falla la portada
// igual se pinta (las secciones con v-if desaparecen en vez de romper la página: degradación elegante)
const [{ data: featured }, { data: categories }] = await Promise.all([
  useAsyncData(`home-featured:${FEATURED}`, () => api.products({ collection: FEATURED, limit: 8 }).then((result) => result.data).catch(() => [])),
  useAsyncData("store-categories", () => api.categories().catch(() => [])),
]);
// collage => las 3 primeras fotos de la colección para el hero (contenido real, sin imágenes de relleno)
const collage = computed(() => (featured.value ?? []).filter((product) => product.imageUrl).slice(0, 3));

useSeoMeta({ title: () => t("store.home.metaTitle"), description: () => t("store.home.heroText") });
useHead({
  script: [{ type: "application/ld+json", innerHTML: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "eCommerce Web3", url: siteUrl, potentialAction: { "@type": "SearchAction", target: `${siteUrl}${useRuntimeConfig().app.baseURL}products?q={search_term_string}`, "query-input": "required name=search_term_string" } }) }],
});
</script>

<template>
  <div class="flex flex-col gap-16">
    <!-- Hero: texto a la izquierda y collage a la derecha (en móvil el collage se oculta: primera pantalla más liviana) -->
    <section aria-labelledby="hero-title" class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-brand to-indigo-900 px-6 py-14 text-brand-foreground sm:px-12 lg:py-20">
      <!-- Brillo decorativo: puro CSS (blur), aria-hidden porque no aporta información -->
      <div aria-hidden="true" class="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/30 blur-3xl" />
      <div class="relative grid items-center gap-10 lg:grid-cols-2">
        <div class="flex max-w-xl flex-col gap-5">
          <p class="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-widest">{{ $t("store.home.eyebrow") }}</p>
          <h1 id="hero-title" class="text-4xl font-bold leading-tight sm:text-5xl">{{ $t("store.home.heroTitle") }}</h1>
          <p class="text-lg text-white/80">{{ $t("store.home.heroText") }}</p>
          <div class="flex flex-wrap gap-3">
            <NuxtLink :to="localePath(routes.products)" class="rounded-full bg-white px-6 py-3 font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none">{{ $t("store.home.shopNow") }}</NuxtLink>
            <a :href="nextAppUrl(storefrontUrl, locale, '/account/loyalty')" class="rounded-full border border-white/40 px-6 py-3 font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{{ $t("store.home.loyalty") }}</a>
          </div>
        </div>
        <!-- Collage: grid de 2 columnas, la primera foto ocupa 2 filas; enlaces reales al detalle de cada producto -->
        <ul v-if="collage.length === 3" class="hidden grid-cols-2 grid-rows-2 gap-4 lg:grid" :aria-label="$t('store.home.featured')">
          <li v-for="(product, index) in collage" :key="product.id" :class="index === 0 ? 'row-span-2' : ''">
            <NuxtLink :to="localePath(routes.product(product.slug))" class="group block size-full overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
              <!-- "eager" + fetchpriority alta solo en la primera: es candidata a LCP -->
              <img :src="product.imageUrl ?? ''" :alt="product.imageAlt ?? product.name" :loading="index === 0 ? 'eager' : 'lazy'" :fetchpriority="index === 0 ? 'high' : 'auto'" width="400" height="400" class="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" :class="index === 0 ? 'aspect-[3/4]' : 'aspect-square'" >
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- Franja de beneficios: lista semántica; el ícono es decorativo y el texto lo explica -->
    <section aria-labelledby="benefits-title">
      <h2 id="benefits-title" class="sr-only">{{ $t("store.home.benefitsTitle") }}</h2>
      <ul class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <li v-for="benefit in BENEFITS" :key="benefit.key" class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span aria-hidden="true" class="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-5"><path :d="benefit.icon" /></svg>
          </span>
          <div>
            <p class="text-sm font-semibold text-slate-900">{{ $t(`store.home.benefits.${benefit.key}.title`) }}</p>
            <p class="text-xs text-slate-600">{{ $t(`store.home.benefits.${benefit.key}.text`) }}</p>
          </div>
        </li>
      </ul>
    </section>

    <ForYou />

    <section v-if="categories?.length" aria-labelledby="categories-title" class="flex flex-col gap-5">
      <div>
        <h2 id="categories-title" class="text-2xl font-bold text-slate-900 sm:text-3xl">{{ $t("store.home.shopByCategory") }}</h2>
        <p class="text-slate-600">{{ $t("store.home.categoriesText") }}</p>
      </div>
      <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <li v-for="category in categories" :key="category.id">
          <NuxtLink :to="localePath(routes.category(category.slug))" class="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:aspect-[4/3]">
            <img v-if="category.imageUrl" :src="category.imageUrl" alt="" loading="lazy" class="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" >
            <!-- Degradado inferior => el texto blanco cumple contraste sobre cualquier foto -->
            <span aria-hidden="true" class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span class="relative text-xl font-bold text-white">{{ category.name }}</span>
            <!-- Subcategorías (ej. Accesorios: perfumes, bolsos, relojes, gafas) como pista de lo que hay dentro -->
            <span v-if="category.children.length" class="relative line-clamp-1 text-sm text-white/85">{{ category.children.map((child) => child.name).join(" · ") }}</span>
            <span class="relative mt-2 text-sm font-medium text-white underline-offset-4 group-hover:underline">{{ $t("store.home.explore") }} →</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="featured?.length" aria-labelledby="featured-title" class="flex flex-col gap-5">
      <div class="flex items-end justify-between gap-4">
        <div>
          <h2 id="featured-title" class="text-2xl font-bold text-slate-900 sm:text-3xl">{{ $t("store.home.featured") }}</h2>
          <p class="text-slate-600">{{ $t("store.home.featuredText") }}</p>
        </div>
        <NuxtLink :to="localePath({ path: routes.products, query: { collection: FEATURED } })" class="shrink-0 text-sm font-semibold text-accent hover:underline">{{ $t("store.home.viewCollection") }} →</NuxtLink>
      </div>
      <ProductGrid :products="featured" :priority-count="4" />
    </section>

    <aside :aria-label="$t('store.home.loyalty')" class="flex flex-col items-start justify-between gap-4 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-100 p-8 sm:flex-row sm:items-center">
      <div>
        <p class="text-xl font-bold text-slate-900">{{ $t("store.home.pointsInvite") }}</p>
        <p class="text-sm text-slate-700">{{ $t("store.home.pointsRule", { amount: formatMoney(100_000, "COP", locale) }) }}</p>
      </div>
      <a :href="nextAppUrl(storefrontUrl, locale, '/register')" class="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{{ $t("store.home.join") }}</a>
    </aside>
  </div>
</template>
