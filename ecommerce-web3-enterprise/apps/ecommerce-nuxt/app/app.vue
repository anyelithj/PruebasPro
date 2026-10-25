<!--
  app.vue (Nuxt) => raíz de la aplicación (HOC): layout de la ruta + página, anunciador de rutas para lectores de
  pantalla, enlace "Saltar al contenido" (WCAG 2.4.1), avisos (Toast) y, en el navegador, el estado de la PWA.
  "useLocaleHead" (@nuxtjs/i18n) => lang, dir y enlaces hreflang/canonical por idioma (SEO internacional).
-->
<script setup lang="ts">
import Toast from "~~/shared/ui/Toast.vue";
import PWAStatusBar from "~~/widgets/pwa/PWAStatusBar.vue";

const head = useLocaleHead();
// useHead => aplica atributos de <html> y los <link> alternos en SSR y en cada cambio de idioma (reactivo)
useHead(() => ({ htmlAttrs: { lang: head.value.htmlAttrs.lang }, link: head.value.link, meta: head.value.meta }));
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-slate-900 antialiased">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow">
      {{ $t("common.skipToContent") }}
    </a>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toast />
    <!-- ClientOnly => el estado del Service Worker solo existe en el navegador -->
    <ClientOnly><PWAStatusBar /></ClientOnly>
  </div>
</template>
