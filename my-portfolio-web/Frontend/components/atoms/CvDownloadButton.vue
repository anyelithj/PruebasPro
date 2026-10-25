<!--
  [Atomic Design: Atom — botón/enlace de descarga del CV.]
  [SRP: solo descarga. URL desde runtimeConfig (NUXT_PUBLIC_CV_URL, default /cv.pdf).]
  [a11y: <a download> con aria-label; abre/descarga sin romper SPA.]
-->
<script setup lang="ts">
import { useRuntimeConfig } from '#app';
import AppIcon from '~/components/atoms/AppIcon.vue';

withDefaults(
  defineProps<{ variant?: 'solid' | 'ghost'; label?: string }>(),
  { variant: 'solid', label: 'Descargar CV' },
);

const cvUrl = useRuntimeConfig().public.cvUrl as string;
</script>

<template>
  <a
    :href="cvUrl"
    download
    target="_blank"
    rel="noopener"
    :aria-label="label"
    :class="[
      'inline-flex items-center gap-2 rounded-md px-6 py-3 font-semibold transition-all duration-300',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400',
      variant === 'solid'
        ? 'border border-gray-300 bg-white/80 text-gray-800 hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
        : 'text-white/90 hover:text-white',
    ]"
  >
    <AppIcon :icon="['fas', 'download']" :aria-hidden="true" />
    <span>{{ label }}</span>
  </a>
</template>
