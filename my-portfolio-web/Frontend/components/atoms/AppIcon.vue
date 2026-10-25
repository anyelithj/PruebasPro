<!--
  [Atomic Design: Atom — wrapper sobre <font-awesome-icon> para abstraer la dep.]
  [SOLID/DIP: si mañana cambiamos a Iconify, solo se cambia este atom (anti-corruption layer).]
  [dep: @fortawesome/vue-fontawesome — componente FontAwesomeIcon registrado globalmente.]
-->
<script setup lang="ts">
// [typescript: import type — solo el tipo Tuple del icono.]
import type { FontAwesomeIconRef } from '~/shared/domain/entities/SocialLink'

// [vue: defineProps — props tipadas.]
defineProps<{
  icon: FontAwesomeIconRef       // [Tuple [prefix, iconName].]
  ariaHidden?: boolean           // [a11y — ocultar a SR cuando ya hay label en contenedor.]
}>()
</script>

<template>
  <!--
    [Wrap en <span> para fijar tamaños desde fuera vía clases del padre.]
    [aria-hidden permite a la capa contenedora controlar el rol semántico.]
  -->
  <span :aria-hidden="ariaHidden ?? true" class="inline-flex items-center justify-center leading-none">
    <font-awesome-icon :icon="icon" />
  </span>
</template>
