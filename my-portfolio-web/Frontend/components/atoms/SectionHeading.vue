<!--
  [Atomic Design: Atom — heading reutilizable para secciones.]
  [Patrón: Presentational; centraliza estilos de h2 (DRY de duplicación previa).]
  [SEO/a11y: <h2> con id opcional → ancla de navegación + landmark.]
-->
<script setup lang="ts">
import type { FontAwesomeIconRef } from '~/shared/domain/entities/SocialLink'
import AppIcon from './AppIcon.vue'

defineProps<{
  id?: string                 // [id html — usado para aria-labelledby + scroll anchor.]
  icon?: FontAwesomeIconRef   // [Icono opcional al inicio.]
  align?: 'left' | 'center'   // [Alineación. Default center.]
}>()
</script>

<template>
  <h2
    :id="id"
    :class="[
      'text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8',
      align === 'left' ? 'text-left' : 'text-center',
    ]"
  >
    <!-- v-if — render condicional. -->
    <span v-if="icon" class="mr-3 text-indigo-500">
      <AppIcon :icon="icon" :aria-hidden="true" />
    </span>
    <slot />
  </h2>
</template>
