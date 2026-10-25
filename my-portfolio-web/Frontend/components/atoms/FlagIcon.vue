<!--
  [Atomic Design: Atom — bandera SVG por código de idioma.]
  [Patrón: Presentational. Strategy mediante render condicional por code.]
  [Performance: SVGs inline simples (sin requests). ~1KB total.]
  [a11y: role="img" + aria-label (nombre del país).]
-->
<script setup lang="ts">
import { computed } from 'vue'

type LangCode = 'es' | 'en' | 'fr' | 'de' | 'pt'

const props = withDefaults(
  defineProps<{
    code: LangCode | string
    size?: number  // [px — ancho. Alto se deriva 3:2.]
    label?: string
  }>(),
  { size: 22 },
)

const w = computed(() => props.size)
const h = computed(() => Math.round(props.size * (2 / 3)))
</script>

<template>
  <span
    class="flag-icon"
    role="img"
    :aria-label="label ?? code"
    :style="{ width: `${w}px`, height: `${h}px` }"
  >
    <!-- ES — rojo / amarillo / rojo (1:2:1) -->
    <svg v-if="code === 'es'" :width="w" :height="h" viewBox="0 0 6 4" xmlns="http://www.w3.org/2000/svg">
      <rect width="6" height="4" fill="#c60b1e" />
      <rect y="1" width="6" height="2" fill="#ffc400" />
    </svg>

    <!-- EN/US — barras + cantón (simplificado, sin estrellas individuales) -->
    <svg v-else-if="code === 'en'" :width="w" :height="h" viewBox="0 0 19 10" xmlns="http://www.w3.org/2000/svg">
      <rect width="19" height="10" fill="#fff" />
      <g fill="#b22234">
        <rect y="0" width="19" height="0.77" />
        <rect y="1.54" width="19" height="0.77" />
        <rect y="3.08" width="19" height="0.77" />
        <rect y="4.62" width="19" height="0.77" />
        <rect y="6.15" width="19" height="0.77" />
        <rect y="7.69" width="19" height="0.77" />
        <rect y="9.23" width="19" height="0.77" />
      </g>
      <rect width="7.6" height="5.38" fill="#3c3b6e" />
      <g fill="#fff">
        <circle cx="1.2" cy="1" r="0.35" />
        <circle cx="2.7" cy="1" r="0.35" />
        <circle cx="4.2" cy="1" r="0.35" />
        <circle cx="5.7" cy="1" r="0.35" />
        <circle cx="1.95" cy="2.2" r="0.35" />
        <circle cx="3.45" cy="2.2" r="0.35" />
        <circle cx="4.95" cy="2.2" r="0.35" />
        <circle cx="6.45" cy="2.2" r="0.35" />
        <circle cx="1.2" cy="3.4" r="0.35" />
        <circle cx="2.7" cy="3.4" r="0.35" />
        <circle cx="4.2" cy="3.4" r="0.35" />
        <circle cx="5.7" cy="3.4" r="0.35" />
      </g>
    </svg>

    <!-- FR — azul / blanco / rojo (vertical) -->
    <svg v-else-if="code === 'fr'" :width="w" :height="h" viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">
      <rect width="1" height="2" fill="#002395" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ed2939" />
    </svg>

    <!-- DE — negro / rojo / oro (horizontal) -->
    <svg v-else-if="code === 'de'" :width="w" :height="h" viewBox="0 0 5 3" xmlns="http://www.w3.org/2000/svg">
      <rect width="5" height="1" fill="#000" />
      <rect y="1" width="5" height="1" fill="#dd0000" />
      <rect y="2" width="5" height="1" fill="#ffce00" />
    </svg>

    <!-- PT — verde / rojo + esfera amarilla simplificada -->
    <svg v-else-if="code === 'pt'" :width="w" :height="h" viewBox="0 0 6 4" xmlns="http://www.w3.org/2000/svg">
      <rect width="2.4" height="4" fill="#046a38" />
      <rect x="2.4" width="3.6" height="4" fill="#da291c" />
      <circle cx="2.4" cy="2" r="0.85" fill="#ffe900" stroke="#000" stroke-width="0.08" />
      <circle cx="2.4" cy="2" r="0.55" fill="#fff" stroke="#000" stroke-width="0.06" />
    </svg>

    <!-- Fallback — cuadro gris -->
    <svg v-else :width="w" :height="h" viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">
      <rect width="3" height="2" fill="#9ca3af" />
    </svg>
  </span>
</template>

<style scoped>
.flag-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  line-height: 0;
  flex-shrink: 0;
}
.flag-icon svg {
  display: block;
}
</style>
