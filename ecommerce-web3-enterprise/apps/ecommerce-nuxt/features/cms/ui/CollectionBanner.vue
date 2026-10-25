<!--
  CollectionBanner.vue (Vue 3) => banner de una colección del catálogo: imagen de fondo, nombre, descripción y
  vigencia. Patrón Factory: con imagen => banner con superposición oscura (contraste AA del texto); sin imagen =>
  banner de color de marca. La imagen es la LCP de la página: fetchpriority="high" y sin lazy.
-->
<script setup lang="ts">
import type { CatalogCollection } from "~~/entities/cms/model/cms.types";
import { formatDate } from "~~/shared/lib/format";

// "lookDiscountPercent" opcional (Partial): la vista previa del editor puede no tenerlo aún
defineProps<{ collection: Pick<CatalogCollection, "name" | "description" | "imageUrl" | "startsAt" | "endsAt" | "productCount"> & Partial<Pick<CatalogCollection, "lookDiscountPercent">> }>();
const { locale } = useI18n();
</script>

<template>
  <section class="relative isolate overflow-hidden rounded-xl bg-brand px-6 py-16 text-white sm:px-10">
    <img v-if="collection.imageUrl" :src="collection.imageUrl" alt="" fetchpriority="high" class="absolute inset-0 -z-10 size-full object-cover" >
    <div v-if="collection.imageUrl" class="absolute inset-0 -z-10 bg-black/50" aria-hidden="true" />
    <h1 class="text-3xl font-bold sm:text-4xl">{{ collection.name }}</h1>
    <p v-if="collection.description" class="mt-3 max-w-2xl text-base text-slate-100">{{ collection.description }}</p>
    <p class="mt-4 text-sm text-slate-200">
      {{ $t("cms.collection.products", { count: collection.productCount }) }}
      <template v-if="collection.endsAt"> · {{ $t("cms.collection.until", { date: formatDate(collection.endsAt, locale) }) }}</template>
    </p>
    <!-- RF-05.5 descuento automático por llevar el look completo (se aplica en el checkout) -->
    <p v-if="collection.lookDiscountPercent" class="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900">
      {{ $t("cms.collection.lookDiscount", { percent: collection.lookDiscountPercent }) }}
    </p>
  </section>
</template>
