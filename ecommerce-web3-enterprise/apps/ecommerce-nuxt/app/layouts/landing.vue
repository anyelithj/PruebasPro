<!--
  landing.vue (layout de Nuxt, HOC) => landings promocionales a pantalla completa: cabecera mínima (sin menú que
  distraiga de la conversión) y contenido sin márgenes laterales para el hero.
-->
<script setup lang="ts">
import { routes } from "~~/shared/constants/routes";

const localePath = useLocalePath();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="absolute inset-x-0 top-0 z-10">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <NuxtLink :to="localePath(routes.landings)" class="font-semibold text-white drop-shadow">eCommerce Web3</NuxtLink>
      </div>
    </header>
    <main id="main-content" class="flex-1"><slot /></main>
    <footer class="border-t py-6 text-center text-xs text-slate-500">{{ $t("footer.privacy") }}</footer>
  </div>
</template>
