<!--
  page.vue (/social/checkout) => generador de enlaces de compra social con UTM y código de referido (Guard ADMIN/VENDOR).
  La compra ocurre en el checkout único de la tienda Next.js; aquí solo se crean enlaces atribuibles.
-->
<script setup lang="ts">
import SocialCheckoutForm from "~~/features/social-commerce/ui/SocialCheckoutForm.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"] });
const { t } = useI18n();
useSeoMeta({ title: () => t("social.checkout.title") });
</script>

<template>
  <div class="flex flex-col gap-6">
    <header>
      <h1 class="text-2xl font-semibold">{{ $t("social.checkout.title") }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t("social.checkout.description") }}</p>
    </header>
    <SocialCheckoutForm />
  </div>
</template>
