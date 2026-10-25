<!--
  ThemeToggle.vue => botón de tema claro/oscuro (36×36), espejo de ThemeToggle.tsx de Next.js. El tema vive en la
  cookie "theme" (compartida entre Next y Nuxt: mismo origen tras Nginx, y en localhost la cookie ignora el puerto);
  el script de <head> (nuxt.config.ts) la aplica antes de pintar. Textos del manifiesto compartido (admin-nav.json).
-->
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "#imports";
import type { AdminNav } from "@ecommerce/shared-types";
import navData from "@ecommerce/shared-types/admin-nav.json";
import Button from "./Button.vue";

const { locale } = useI18n();
const dark = ref(false);
onMounted(() => (dark.value = document.documentElement.classList.contains("dark"))); // Lo que aplicó el script de <head>
const text = (navData as AdminNav).text;
const label = computed(() => (dark.value ? text.themeLight : text.themeDark)[locale.value === "en" ? "en" : "es"]);

const toggle = () => {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("dark", dark.value);
  document.cookie = `theme=${dark.value ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
};
</script>

<template>
  <Button size="icon" variant="ghost" :title="label" :aria-label="label" @click="toggle">
    <!-- Sol en modo oscuro (pasar a claro), luna en modo claro (pasar a oscuro) -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true">
      <template v-if="dark"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></template>
      <path v-else d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  </Button>
</template>
