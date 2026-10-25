<!--
  page.vue (/brands/[slug]) => RF-05.4 landing SEO de una marca: logo en alta resolución (Cloudinary, RF-05.6), insignias
  premium/exclusiva (RF-05.3), país de origen e historia (RF-05.1) y sus productos (RF-05.2). SSR + ISR (1 h) con
  petición ANÓNIMA (caché compartida). SEO: título/descripción/Open Graph (useSEOMeta), JSON-LD schema.org/Brand y
  migas de pan. Paginación rastreable con ?page=. Patrones: Repository (storeApi), Adapter (SchemaOrgMeta).
-->
<script setup lang="ts">
import { computed } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { storeApi } from "~~/features/store/api/store.api";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam, eventsQuerySchema } from "~~/features/seo/lib/seo.validator";
import SchemaOrgMeta from "~~/features/seo/ui/SchemaOrgMeta.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import ProductGrid from "~~/features/product/ui/ProductGrid.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import Badge from "~~/shared/ui/Badge.vue";
import { routes } from "~~/shared/constants/routes";

const route = useRoute();
// Guard: slug inválido => 404 real (no se consulta la API con basura)
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const page = computed(() => eventsQuerySchema.parse(route.query).page); // Mismo validador de ?page= (DRY)
const api = storeApi(useApi({ anonymous: true }));
const { data: brand, error } = await useAsyncData(`brand:${slug.data}`, () => api.brand(slug.data));
if (error.value || !brand.value) throw createError({ statusCode: 404, fatal: true });
// "watch: [page]" => al cambiar ?page= se vuelve a pedir solo el listado
const { data: products } = await useAsyncData(() => `brand-products:${slug.data}:${page.value}`, () => api.products({ brand: slug.data, page: page.value, limit: 24 }), { watch: [page] });
const totalPages = computed(() => products.value?.meta?.totalPages ?? 1);

const { locale } = useI18n();
const { public: config } = useRuntimeConfig();
// "Intl.DisplayNames" (API nativa) => "CO" -> "Colombia" en el idioma activo, sin tablas propias
const countryName = computed(() => (brand.value?.country ? new Intl.DisplayNames([locale.value], { type: "region" }).of(brand.value.country) : null));
useSEOMeta(() => ({ title: brand.value?.name ?? "", description: brand.value?.description ?? brand.value?.story?.slice(0, 160), image: brand.value?.logoUrl, path: routes.brand(slug.data) }));
</script>

<template>
  <article v-if="brand" class="flex flex-col gap-8">
    <SchemaOrgMeta type="Brand" :data="{ title: brand.name, description: brand.description, image: brand.logoUrl, url: `${config.siteUrl}${routes.brand(brand.slug)}` }" />
    <BreadcrumbNav :items="[{ label: $t('brand.title'), to: routes.brands }, { label: brand.name }]" />
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center">
      <!-- Logo de Cloudinary: ancho/alto fijos evitan el salto de diseño (CLS) -->
      <img v-if="brand.logoUrl" :src="brand.logoUrl" :alt="$t('brand.logoAlt', { name: brand.name })" width="128" height="128" fetchpriority="high" class="size-32 rounded-xl border bg-white object-contain p-2" >
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-3xl font-bold">{{ brand.name }}</h1>
          <Badge v-if="brand.isPremium" tone="info">{{ $t("brand.premium") }}</Badge>
          <Badge v-if="brand.isExclusive" tone="success">{{ $t("brand.exclusive") }}</Badge>
        </div>
        <p v-if="countryName" class="text-sm text-slate-600">{{ $t("brand.origin", { country: countryName }) }}</p>
        <p v-if="brand.description" class="max-w-3xl text-slate-700">{{ brand.description }}</p>
        <a v-if="brand.website" :href="brand.website" target="_blank" rel="noopener noreferrer" class="text-sm font-medium underline">{{ $t("brand.website") }}</a>
      </div>
    </header>
    <section v-if="brand.story" aria-labelledby="brand-story" class="max-w-3xl">
      <h2 id="brand-story" class="mb-2 text-xl font-semibold">{{ $t("brand.story") }}</h2>
      <!-- "whitespace-pre-line" => respeta los saltos de párrafo del texto plano (sin v-html: sin XSS) -->
      <p class="whitespace-pre-line text-slate-700">{{ brand.story }}</p>
    </section>
    <section aria-labelledby="brand-products" class="flex flex-col gap-4">
      <h2 id="brand-products" class="text-xl font-semibold">{{ $t("brand.products", { count: products?.meta?.total ?? brand.productCount }) }}</h2>
      <ProductGrid v-if="products?.data.length" :products="products.data" :priority-count="4" />
      <EmptyState v-else :title="$t('brand.emptyTitle')" :description="$t('brand.emptyText')" />
      <nav v-if="totalPages > 1" :aria-label="$t('common.pagination')" class="flex justify-between text-sm">
        <NuxtLink v-if="page > 1" :to="{ query: { page: page - 1 } }" rel="prev" class="underline">{{ $t("common.previous") }}</NuxtLink><span v-else />
        <NuxtLink v-if="page < totalPages" :to="{ query: { page: page + 1 } }" rel="next" class="underline">{{ $t("common.next") }}</NuxtLink>
      </nav>
    </section>
  </article>
</template>
