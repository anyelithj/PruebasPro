<!--
  [Atomic Design: Atom — un solo skill (icono + nombre).]
  [Patrón: Presentational. Cero efectos secundarios.]
-->
<script setup lang="ts">
import type { Skill } from '~/shared/domain/entities/Skill'
import AppIcon from './AppIcon.vue'

// [vue: defineProps — recibe la entidad Skill.]
defineProps<{ skill: Skill }>()
</script>

<template>
  <!--
    [group para hover-coordinated del nombre.]
    [a11y: aria-label en contenedor describe la skill.]
  -->
  <div
    :aria-label="`Habilidad: ${skill.name}`"
    class="flex flex-col items-center justify-center gap-2 group"
  >
    <span
      :class="[
        'text-5xl transition duration-300 transform-gpu group-hover:scale-110',
        skill.isBrand ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200',
      ]"
    >
      <AppIcon :icon="skill.icon" :aria-hidden="true" />
    </span>
    <span class="text-base font-medium text-gray-800 dark:text-white group-hover:underline">
      {{ skill.name }}
    </span>
  </div>
</template>
