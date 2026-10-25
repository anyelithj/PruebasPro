<!--
  [Nuxt entrypoint — wrapper raíz.]
  [Atomic Design: Template-level — solo orquesta layout + page.]
  [SEO base: useSeoMeta site-wide; las páginas pueden sobrescribir.]
-->
<script setup lang="ts">
// [#imports — auto-imports de Nuxt: useHead, useSeoMeta.]
import { useHead, useSeoMeta } from '#imports'
// [Composable a11y unificado.]
import { useThemeMode } from '~/composables/useThemeMode'
// [Import explícito: evita el warning "Failed to resolve component: AppToast" en el root.]
import AppToast from '~/components/atoms/AppToast.vue'

// [Composable: lee modo tema. Class-based dark mode (Tailwind).]
const { isDark } = useThemeMode()

// [SEO: meta site-wide — base que las páginas extienden.]
useSeoMeta({
  titleTemplate: (title) => (title ? `${title} | Portafolio` : 'Portafolio | Web3 & AI Engineer'),
  description: 'Portafolio profesional · Vue, Nuxt 3, TypeScript, Tailwind CSS, GSAP.',
  themeColor: '#7e22ce',
  viewport: 'width=device-width, initial-scale=1',
})

// [useHead — html attrs + iconos.]
useHead({
  htmlAttrs: { lang: 'es' },
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
  ],
})
</script>

<template>
  <!--
    [Nuxt: NuxtLayout monta el layout activo; NuxtPage el contenido de la ruta.]
    [class :class="{dark: isDark}" — Tailwind dark mode controlado vía clase.]
  -->
  <div :class="{ dark: isDark }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- [OBSERVER] host global de toasts -->
    <AppToast />
  </div>
</template>
