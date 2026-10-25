<!--
  ProductGrid.vue => cuadrícula responsive de tarjetas (2 columnas en móvil, 4 en escritorio). Las primeras imágenes
  se cargan sin lazy (están en la primera pantalla: mejor LCP).
-->
<script setup lang="ts">
import type { StoreProduct } from "~~/entities/product/model/product.types";
import ProductCard from "./ProductCard.vue";

withDefaults(defineProps<{ products: StoreProduct[]; priorityCount?: number }>(), { priorityCount: 0 });
</script>

<template>
  <ul class="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
    <li v-for="(product, index) in products" :key="product.id"><ProductCard :product="product" :priority="index < priorityCount" /></li>
  </ul>
</template>
