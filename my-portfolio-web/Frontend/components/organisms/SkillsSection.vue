<!--
  [Atomic Design: Organism — sección Skills.]
  [Patrón Vue: Container — consume use case via composable; renderiza grid de atoms SkillBadge.]
  [Patrón Data Provider — useSkills() (Provide/Inject + Hexagonal use case).]
-->
<script setup lang="ts">
// [vue: ref — para template ref del contenedor (animación stagger).]
import { ref } from 'vue'
// [Data Provider Pattern.]
import { useSkills } from '~/composables/useSkills'
// [DRY animation.]
import { useGsapStagger } from '~/composables/useGsapStagger'
// [Atoms.]
import SectionHeading from '~/components/atoms/SectionHeading.vue'
import SkillBadge from '~/components/atoms/SkillBadge.vue'

// [Composable inyecta lista readonly desde dominio.]
const { skills } = useSkills()

const gridEl = ref<HTMLElement | null>(null)
useGsapStagger(gridEl, { y: 16, duration: 0.7, stagger: 0.08 })
</script>

<template>
  <section
    id="skills"
    aria-labelledby="skills-heading"
    class="py-20 bg-white dark:bg-gray-900"
  >
    <div class="max-w-5xl mx-auto px-4 text-center">
      <SectionHeading id="skills-heading" :icon="['fas', 'code']">
        Habilidades Tecnológicas
      </SectionHeading>

      <!--
        [grid responsive — 2/3/4 columnas según breakpoint.]
        [role="list" + role="listitem" — semántica explícita.]
      -->
      <div
        ref="gridEl"
        role="list"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8"
      >
        <div v-for="skill in skills" :key="skill.id" role="listitem">
          <SkillBadge :skill="skill" />
        </div>
      </div>
    </div>
  </section>
</template>
