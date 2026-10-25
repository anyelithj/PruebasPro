<!--
  page.vue (/cart) => carrito a página completa (sin sesión => login único). Solo navegador: datos privados.
-->
<script setup lang="ts">
import { onMounted } from "vue";
import { useCartStore } from "~~/features/cart/model/cart.store";
import CartPanel from "~~/features/cart/ui/CartPanel.vue";

definePageMeta({ middleware: ["auth"] });
const { t } = useI18n();
useSeoMeta({ title: () => t("store.cart.title"), robots: "noindex" });
const cart = useCartStore();
onMounted(() => cart.load());
</script>

<template>
  <section class="mx-auto flex max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">{{ $t("store.cart.title") }}</h1>
    <CartPanel />
  </section>
</template>
