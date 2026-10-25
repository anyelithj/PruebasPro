<!--
  default.vue (layout de Nuxt, HOC) => tienda y páginas públicas de contenido: cabecera de la tienda (buscador,
  carrito, cuenta, categorías y secciones), <main id="main-content">, pie y carrito lateral.
  Las categorías del menú se piden una vez (clave compartida de useAsyncData) y se reutilizan entre páginas.
-->
<script setup lang="ts">
import { useApi } from "~~/shared/lib/api-client";
import { storeApi } from "~~/features/store/api/store.api";
import { useCartStore } from "~~/features/cart/model/cart.store";
import StoreHeader from "~~/widgets/navigation/StoreHeader.vue";
import StoreFooter from "~~/widgets/navigation/StoreFooter.vue";
import CartPanel from "~~/features/cart/ui/CartPanel.vue";
import Modal from "~~/shared/ui/Modal.vue";

const api = storeApi(useApi({ anonymous: true }));
// Si Express no responde, la tienda se muestra igual con el menú vacío (degradación elegante)
const { data: categories } = await useAsyncData("store-categories", () => api.categories().catch(() => []));
const cart = useCartStore();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <StoreHeader :categories="categories ?? []" />
    <main id="main-content" class="mx-auto w-full max-w-7xl flex-1 px-4 py-8"><slot /></main>
    <StoreFooter />
    <Modal v-model:open="cart.isOpen" :title="$t('store.cart.title')"><CartPanel /></Modal>
  </div>
</template>
