<!--
  [Atomic Design: Organism — sección "Conecta conmigo".]
  [Patrón: Container — consume useSocialLinks (Hexagonal use case).]
  [Bug-fix de alineación GitHub: delegado al atom SocialIconButton (caja 48x48 fija).]
-->
<script setup lang="ts">
import { useSocialLinks } from '~/composables/useSocialLinks'
import SectionHeading from '~/components/atoms/SectionHeading.vue'
import SocialIconList from '~/components/molecules/SocialIconList.vue'

// [Data Provider Pattern — links ya readonly desde dominio.]
const { links } = useSocialLinks()
</script>

<template>
  <section
    id="social"
    aria-labelledby="social-heading"
    class="py-16 bg-gray-50 dark:bg-gray-900 transition-colors duration-300"
  >
    <div class="max-w-4xl mx-auto text-center px-4">
      <SectionHeading id="social-heading">Conecta conmigo</SectionHeading>
      <SocialIconList :links="links" />
    </div>
  </section>
</template>
