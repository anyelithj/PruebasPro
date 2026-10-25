<!--
  [Atomic Design: Atom — contenedor genérico con sombra y padding.]
  [Patrón: Presentational. Slot-based — máxima reutilización (DRY).]
-->
<script setup lang="ts">
// [vue: defineProps tipado.]
defineProps<{
  // [a11y: aria-label opcional cuando el contenido no es self-describing.]
  ariaLabel?: string
}>()
</script>

<template>
  <!--
    [role="article" — landmark para lectores de pantalla cuando es contenido auto-contenido.]
    [transform-gpu — fuerza compositor GPU para hover (perf).]
  -->
  <!--
    [h-full + flex flex-col — card ocupa toda la altura de la celda grid;
     hijos se apilan verticalmente. Permite que ProjectCard alinee el link al fondo
     usando `mt-auto` en su último elemento.]
  -->
  <div
    role="article"
    :aria-label="ariaLabel"
    class="h-full flex flex-col rounded-2xl shadow-md hover:shadow-xl bg-white dark:bg-gray-800 p-6
           transform-gpu transition duration-300 hover:-translate-y-1
           focus-within:ring-2 focus-within:ring-indigo-400"
  >
    <!-- vue: <slot /> — contenido inyectable. -->
    <slot />
  </div>
</template>
