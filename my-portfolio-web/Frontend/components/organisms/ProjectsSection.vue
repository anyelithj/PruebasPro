<!--
  [Atomic Design: Organism — sección Projects.]
  [Patrón: Container; consume useProjectsApi → GET /api/projects (BFF → backend Nest/FastAPI).]
  [Resiliencia: el BFF hace fallback a datos estáticos si el backend es stub, la UI nunca queda vacía.]
  [Render Pattern: v-for sobre molecule ProjectCard + estado de carga accesible.]
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useProjectsApi } from '~/composables/useProjectsApi'
import { useGsapStagger } from '~/composables/useGsapStagger'
import SectionHeading from '~/components/atoms/SectionHeading.vue'
import ProjectCard from '~/components/molecules/ProjectCard.vue'

// Proyectos en vivo desde el backend elegido; lo que se crea en /admin/projects aparece aquí.
const { projects, pending } = useProjectsApi()

const gridEl = ref<HTMLElement | null>(null)
useGsapStagger(gridEl, { y: 24, duration: 0.8, stagger: 0.12 })
</script>

<template>
  <section
    id="projects"
    aria-labelledby="projects-heading"
    class="py-20 bg-gray-50 dark:bg-gray-900"
  >
    <div class="max-w-6xl mx-auto px-4">
      <SectionHeading id="projects-heading" :icon="['fas', 'laptop-code']">
        Proyectos Destacados
      </SectionHeading>

      <!-- a11y: estado de carga anunciado por lectores de pantalla. -->
      <p
        v-if="pending && !projects.length"
        class="text-center text-gray-500 dark:text-gray-400"
        role="status"
        aria-live="polite"
      >
        Cargando proyectos…
      </p>

      <div
        v-else
        ref="gridEl"
        class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
      >
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
        />
      </div>
    </div>
  </section>
</template>
