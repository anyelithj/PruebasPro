<!--
  [Atomic Design: Molecule — colección de SocialIconButton (atoms).]
  [Patrón Vue: Container/Presentational — esta molecule maneja layout + animación;
   los atoms solo presentan.]
  [SOLID/SRP: solo orquesta lista + entrada animada; sin lógica de dominio.]
-->
<script setup lang="ts">
// [vue: ref — referencia reactiva al contenedor para animarlo (template ref).]
import { ref } from 'vue'
// [typescript: import type — solo tipos.]
import type { SocialLink } from '~/shared/domain/entities/SocialLink'
// [Atom hijo.]
import SocialIconButton from '~/components/atoms/SocialIconButton.vue'
// [Composable DRY de animación.]
import { useGsapStagger } from '~/composables/useGsapStagger'

// [vue: defineProps — recibe la lista (Data Provider Pattern: el organism inyecta).]
defineProps<{
  links: readonly SocialLink[]
}>()

// [vue: ref<HTMLElement | null> — typed template ref. null hasta que monte.]
const containerEl = ref<HTMLElement | null>(null)

// [Composable — anima children al montar (respeta reduce-motion).]
useGsapStagger(containerEl, { y: 20, duration: 1, stagger: 0.1, ease: 'power3.out' })
</script>

<template>
  <!--
    [flex-wrap + gap-6 — responsive sin media queries.]
    [items-center — centra en el cross-axis (cada hijo es 48x48 fijo, alineación uniforme garantizada).]
    [role="list" + role="listitem" — semántica explícita aunque <a> no es <li>.]
  -->
  <div
    ref="containerEl"
    role="list"
    aria-label="Enlaces a redes sociales"
    class="flex flex-wrap justify-center items-center gap-6"
  >
    <!-- vue: v-for sobre readonly[]. :key — id de la entidad (estable). -->
    <div v-for="link in links" :key="link.id" role="listitem">
      <SocialIconButton :link="link" />
    </div>
  </div>
</template>
