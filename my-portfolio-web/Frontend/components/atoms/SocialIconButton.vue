<!--
  [Atomic Design: Atom — botón-link de red social.]
  [Patrón: Presentational + ARIA-accessible.]
  [Bug-fix histórico: GitHub se desalineaba porque cada glyph FontAwesome tiene métricas distintas.
   Solución: contenedor cuadrado fijo `w-12 h-12 flex items-center justify-center`
   → todos los iconos comparten el mismo bounding box, baseline irrelevante.]
-->
<script setup lang="ts">
// [typescript: import type — tipo de la entidad SocialLink.]
import type { SocialLink } from '~/shared/domain/entities/SocialLink'
// [Atom AppIcon — abstracción sobre FontAwesome.]
import AppIcon from './AppIcon.vue'

// [vue: defineProps — recibe la entidad completa (Tell-Don't-Ask).]
defineProps<{
  link: SocialLink
}>()
</script>

<template>
  <!--
    [a11y:
      - aria-label personalizado por red.
      - rel="noopener noreferrer" — seguridad al abrir target="_blank" (anti tabnabbing).
      - focus-visible:ring para teclado.
    [perf: transform-gpu, will-change-transform en hover.]
    [Bug-fix GitHub: w-12 h-12 + items-center + justify-center → ancla cuadrada fija → glyphs centrados.]
  -->
  <a
    :href="link.url"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`Ir a mi perfil de ${link.name}`"
    :class="[
      'inline-flex items-center justify-center w-12 h-12 rounded-full',
      'text-3xl leading-none transform-gpu',
      'transition-transform duration-300 hover:scale-110',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400',
      link.colorClass,
    ]"
  >
    <!-- atom AppIcon — aria-hidden true porque el <a> ya provee aria-label. -->
    <AppIcon :icon="link.icon" :aria-hidden="true" />
  </a>
</template>
