<!--
  page.vue (/products/[slug]) => ficha de producto (SSR + ISR, petición ANÓNIMA): galería, migas de pan, precio,
  variantes, "Agregar al carrito" y descripción. JSON-LD Product (rich results con precio y disponibilidad).
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { storeApi } from "~~/features/store/api/store.api";
import { slugParam } from "~~/features/seo/lib/seo.validator";
import { routes } from "~~/shared/constants/routes";
import ProductBuyBox from "~~/features/product/ui/ProductBuyBox.vue";
import ProductPromo from "~~/features/product/ui/ProductPromo.vue"; // RF-13.8 flash, RF-14.4 preventa, RF-14.1 compartir
import ProductReviews from "~~/features/product/ui/ProductReviews.vue"; // RF-15.2/15.3/15.6
import ProductUgc from "~~/features/product/ui/ProductUgc.vue"; // RF-19.11 contenido de clientes

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const api = storeApi(useApi({ anonymous: true }));
const { data: product } = await useAsyncData(`product:${slug.data}`, () => api.product(slug.data).catch(() => null));
if (!product.value) throw createError({ statusCode: 404, fatal: true });
const localePath = useLocalePath();
const activeImage = ref(0);
const image = computed(() => product.value?.images[activeImage.value]);

useSeoMeta({ title: () => product.value?.name ?? "", description: () => product.value?.description.slice(0, 155), ogImage: () => product.value?.images[0]?.url });
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.value.name,
        description: product.value.description,
        image: product.value.images.map((item) => item.url),
        brand: product.value.brand ? { "@type": "Brand", name: product.value.brand.name } : undefined,
        offers: { "@type": "AggregateOffer", priceCurrency: product.value.currency, lowPrice: product.value.minPriceCents / 100, highPrice: product.value.maxPriceCents / 100, availability: product.value.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
      }),
    },
  ],
});
</script>

<template>
  <article v-if="product" class="flex flex-col gap-8">
    <nav :aria-label="$t('nav.breadcrumb')" class="text-sm text-slate-500">
      <ol class="flex flex-wrap gap-1">
        <li><NuxtLink :to="localePath(routes.home)" class="hover:underline">{{ $t("nav.home") }}</NuxtLink> /</li>
        <li v-if="product.category"><NuxtLink :to="localePath(routes.category(product.category.slug))" class="hover:underline">{{ product.category.name }}</NuxtLink> /</li>
        <li aria-current="page" class="text-slate-900">{{ product.name }}</li>
      </ol>
    </nav>
    <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <div class="flex flex-col gap-3">
        <img v-if="image" :src="image.url" :alt="image.alt || product.name" :width="image.width ?? 800" :height="image.height ?? 800" class="aspect-square w-full rounded-lg bg-slate-100 object-cover" >
        <ul v-if="product.images.length > 1" class="flex gap-2 overflow-x-auto" :aria-label="$t('store.product.thumbnails')">
          <li v-for="(item, index) in product.images" :key="item.id" class="shrink-0">
            <button type="button" :aria-pressed="index === activeImage" :aria-label="$t('store.product.viewImage', { n: index + 1 })" :class="['block size-16 overflow-hidden rounded-md border-2', index === activeImage ? 'border-slate-900' : 'border-transparent']" @click="activeImage = index">
              <img :src="item.url" alt="" class="size-full object-cover" >
            </button>
          </li>
        </ul>
      </div>
      <div class="flex flex-col gap-5">
        <!-- RF-05.2/05.4: la marca enlaza a su landing SEO (/brands/[slug]) -->
        <NuxtLink v-if="product.brand" :to="localePath(routes.brand(product.brand.slug))" class="self-start text-sm uppercase tracking-wide text-slate-500 hover:underline">{{ product.brand.name }}</NuxtLink>
        <h1 class="text-3xl font-semibold text-slate-900">{{ product.name }}</h1>
        <ProductPromo :product-id="product.id" :name="product.name" :pre-sale-until="product.preSaleUntil ?? null" />
        <ProductBuyBox :product="product" />
        <section aria-labelledby="description-title" class="border-t pt-5">
          <h2 id="description-title" class="mb-2 font-semibold">{{ $t("store.product.description") }}</h2>
          <p class="whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ product.description }}</p>
        </section>
      </div>
    </div>
    <ProductReviews :product-id="product.id" />
    <ProductUgc :product-id="product.id" />
  </article>
</template>
