<!--
  [Atomic Design: Facade — re-exporta el organism HeroSection.]
  [Patrón: Adapter de compatibilidad — pages/index.vue no necesita cambiar imports.]
  [SOLID/SRP: solo redirige al organism real.]
-->
<script setup lang="ts">
import HeroSection from '~/components/organisms/HeroSection.vue'
</script>

<template>
  <!-- vue: $attrs — bindea atributos pasados (aria-label, etc.) al organism. -->
  <HeroSection v-bind="$attrs" />
</template>
