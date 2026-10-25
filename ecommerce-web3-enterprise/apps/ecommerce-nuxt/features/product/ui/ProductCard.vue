<!--
  ProductCard.vue => tarjeta de producto de la tienda. Patrón "card link" accesible: un solo enlace (en el título)
  cubre toda la tarjeta con un pseudo-elemento => un solo destino de foco por tarjeta.
-->
<script setup lang="ts">
import { computed } from "vue";
import { discountPercent, type ProductBadge, type StoreProduct } from "~~/entities/product/model/product.types";
import { routes } from "~~/shared/constants/routes";
import { formatMoney } from "~~/shared/lib/format";
import Badge from "~~/shared/ui/Badge.vue";

const props = withDefaults(defineProps<{ product: StoreProduct; priority?: boolean }>(), { priority: false });
const { locale } = useI18n();
const localePath = useLocalePath();
const discount = computed(() => discountPercent(props.product.minPriceCents, props.product.compareAtPriceCents));
const money = (cents: number) => formatMoney(cents, props.product.currency, locale.value);
// BADGE_TONE => Strategy declarativa: insignia -> tono del Badge ("Record" obliga a cubrir las tres)
const BADGE_TONE: Record<ProductBadge, "info" | "danger" | "success"> = { NEW: "info", SALE: "danger", BEST_SELLER: "success" };
</script>

<template>
  <article class="group relative flex flex-col gap-2">
    <div class="relative overflow-hidden rounded-lg bg-slate-100">
      <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.imageAlt ?? product.name" :loading="priority ? 'eager' : 'lazy'" width="400" height="400" class="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" >
      <div v-else class="aspect-square w-full" />
      <div class="absolute left-2 top-2 flex flex-col gap-1">
        <Badge v-if="discount" tone="danger">-{{ discount }}%</Badge>
        <Badge v-if="!product.inStock">{{ $t("store.product.soldOut") }}</Badge>
        <!-- RF-04.2 insignias comerciales: texto visible (el color solo refuerza) -->
        <Badge v-for="badge in product.badges ?? []" :key="badge" :tone="BADGE_TONE[badge]">{{ $t(`store.product.badges.${badge}`) }}</Badge>
      </div>
    </div>
    <p v-if="product.brand" class="text-xs uppercase tracking-wide text-slate-500">{{ product.brand.name }}</p>
    <h3 class="line-clamp-2 text-sm font-medium text-slate-900">
      <NuxtLink :to="localePath(routes.product(product.slug))" class="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">{{ product.name }}</NuxtLink>
    </h3>
    <p v-if="product.ratingCount > 0" class="text-xs text-slate-600">
      <span aria-hidden="true" class="text-amber-500">{{ "★".repeat(Math.round(product.ratingAvg)) }}</span>
      <span class="sr-only">{{ $t("store.product.rating", { value: product.ratingAvg.toFixed(1) }) }}</span> ({{ product.ratingCount }})
    </p>
    <p class="flex items-baseline gap-2">
      <span class="font-semibold text-slate-900">{{ product.minPriceCents === product.maxPriceCents ? money(product.minPriceCents) : $t("store.product.from", { price: money(product.minPriceCents) }) }}</span>
      <span v-if="discount && product.compareAtPriceCents" class="text-xs text-slate-500 line-through">{{ money(product.compareAtPriceCents) }}</span>
    </p>
    <!-- "Ver detalle" visible: pista para el usuario; aria-hidden porque el enlace del título ya cubre la tarjeta (un solo destino de foco) -->
    <span aria-hidden="true" class="mt-1 w-fit rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-brand-foreground motion-reduce:transition-none">{{ $t("store.product.viewDetail") }}</span>
  </article>
</template>
