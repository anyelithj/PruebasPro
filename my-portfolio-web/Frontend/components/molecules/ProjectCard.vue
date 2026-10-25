<!--
  [Atomic Design: Molecule — tarjeta de proyecto. Compone AppCard + AppIcon.]
  [Patrón: Presentational. Recibe entidad Project, no la fetcha.]
  [Animaciones: hover tilt 3D suave, glow gradient, badges escala, icono se desliza.]
-->
<script setup lang="ts">
import { ref } from 'vue'
import type { Project } from '~/shared/domain/entities/Project'
import AppCard from '~/components/atoms/AppCard.vue'
import AppIcon from '~/components/atoms/AppIcon.vue'
import { useReducedMotion } from '~/composables/useReducedMotion'

// [vue: defineProps — recibe la entidad completa.]
defineProps<{ project: Project }>()

const cardEl = ref<HTMLElement | null>(null)
const { prefersReducedMotion } = useReducedMotion()

// [Patrón: handler de mouse para tilt 3D — calcula rotación según posición del cursor.]
// [Perf: usa CSS variables + transform; no recrea estilo, solo escribe vars.]
function onMove(e: MouseEvent) {
  if (prefersReducedMotion.value || !cardEl.value) return
  const r = cardEl.value.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  const rotY = (x - 0.5) * 8
  const rotX = (0.5 - y) * 8
  cardEl.value.style.setProperty('--tilt-x', `${rotX}deg`)
  cardEl.value.style.setProperty('--tilt-y', `${rotY}deg`)
  cardEl.value.style.setProperty('--mx', `${x * 100}%`)
  cardEl.value.style.setProperty('--my', `${y * 100}%`)
}

function onLeave() {
  if (!cardEl.value) return
  cardEl.value.style.setProperty('--tilt-x', `0deg`)
  cardEl.value.style.setProperty('--tilt-y', `0deg`)
}
</script>

<template>
  <div
    ref="cardEl"
    class="project-card-wrap group h-full"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <AppCard :aria-label="`Proyecto: ${project.title}`">
      <!-- [Glow gradiente sigue el cursor — capa decorativa, no captura clicks.] -->
      <span class="card-glow" aria-hidden="true" />

      <!-- [Portada opcional (Cloudinary).] -->
      <img
        v-if="project.imageUrl"
        :src="project.imageUrl"
        :alt="project.title"
        loading="lazy"
        class="relative z-10 mb-3 -mt-2 h-36 w-full rounded-lg object-cover"
      />

      <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2 inline-flex items-center gap-2 relative z-10">
        <span class="card-icon">
          <AppIcon :icon="['fas', 'folder-open']" :aria-hidden="true" />
        </span>
        <span>{{ project.title }}</span>
      </h3>

      <!-- [grow — descripción ocupa espacio variable, empuja techs+link al fondo (mt-auto).] -->
      <p class="text-gray-600 dark:text-gray-300 grow relative z-10">{{ project.description }}</p>

      <!--
        [a11y: ul + li para semántica de lista de tecnologías.]
        [mt-auto — empuja este bloque al fondo de la card.]
      -->
      <ul class="flex flex-wrap gap-2 mt-4 relative z-10" aria-label="Tecnologías del proyecto">
        <li
          v-for="tech in project.techs"
          :key="tech"
          class="tech-badge text-xs bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-white px-2 py-1 rounded"
        >
          {{ tech }}
        </li>
      </ul>

      <!--
        [a11y: aria-label explícito describe destino del enlace.]
        [rel="noopener noreferrer" — anti-tabnabbing al usar target="_blank".]
      -->
      <a
        :href="project.link"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`Ver proyecto ${project.title} en una nueva pestaña`"
        class="project-link inline-flex items-center gap-2 mt-4 self-start text-sm text-indigo-600 dark:text-indigo-300
               hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded relative z-10"
      >
        <AppIcon :icon="['fas', 'arrow-right']" :aria-hidden="true" class="link-arrow" />
        <span>Ver proyecto</span>
      </a>
    </AppCard>
  </div>
</template>

<style scoped>
/* [Wrapper aplica perspective para que AppCard interno rote en 3D suave.] */
.project-card-wrap {
  perspective: 1000px;
}

/* [AppCard hijo — selector directo. Aplico transform/transition al div interno.] */
.project-card-wrap :deep([role='article']) {
  position: relative;
  overflow: hidden;
  transform-style: preserve-3d;
  transform: rotateX(var(--tilt-x, 0)) rotateY(var(--tilt-y, 0)) translateZ(0);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.35s ease,
              border-color 0.35s ease;
  border: 1px solid transparent;
}

.project-card-wrap:hover :deep([role='article']) {
  box-shadow:
    0 20px 40px -15px rgba(124, 58, 237, 0.35),
    0 8px 16px -8px rgba(59, 130, 246, 0.25);
  border-color: rgba(165, 98, 255, 0.35);
}

/* [Glow radial que sigue el cursor — coords en CSS vars --mx/--my.] */
.card-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
  background: radial-gradient(
    400px circle at var(--mx, 50%) var(--my, 50%),
    rgba(165, 98, 255, 0.18),
    transparent 45%
  );
  z-index: 0;
}

.project-card-wrap:hover .card-glow {
  opacity: 1;
}

/* [Icono header — rota + escala on hover de la card.] */
.card-icon {
  display: inline-flex;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.project-card-wrap:hover .card-icon {
  transform: rotate(-8deg) scale(1.15);
}

/* [Badges de techs — escala + sombra al hover individual.] */
.tech-badge {
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  cursor: default;
}

.tech-badge:hover {
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 4px 10px -4px rgba(99, 102, 241, 0.5);
}

/* [Flecha del link — se desliza a la derecha al hover del link o card.] */
.link-arrow {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.project-card-wrap:hover .link-arrow,
.project-link:hover .link-arrow,
.project-link:focus-visible .link-arrow {
  transform: translateX(6px);
}

/* [Respeta reduce-motion.] */
@media (prefers-reduced-motion: reduce) {
  .project-card-wrap :deep([role='article']),
  .card-glow,
  .card-icon,
  .tech-badge,
  .link-arrow {
    transition: none !important;
    transform: none !important;
  }
}
</style>
