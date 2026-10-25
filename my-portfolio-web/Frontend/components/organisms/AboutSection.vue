<!--
  [Atomic Design: Organism — sección "Sobre mí".]
  [Patrón Vue: Container — combina texto + ilustración (atom de SVG).]
  [SEO: id="about" + aria-labelledby al heading; semántica clara para crawlers.]
-->
<script setup lang="ts">
// [Atom heading reutilizable.]
import SectionHeading from '~/components/atoms/SectionHeading.vue'
// [Componente de ilustración (será dynamic import para code-split en organisms grandes;
//  aquí es ligero, import directo es OK).]
import FemaleDeveloperIllustration from '~/components/illustrations/FemaleDeveloperIllustration.vue'
</script>

<template>
  <section
    id="about"
    aria-labelledby="about-heading"
    class="relative py-20 px-6 md:px-16 bg-white dark:bg-zinc-900
           text-zinc-800 dark:text-zinc-100 transition-colors duration-500"
  >
    <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <!-- [Columna texto] -->
      <div>
        <!-- [Atom heading — left-aligned aquí, override del default center.] -->
        <SectionHeading id="about-heading" align="left">
          <span class="text-purple-600 dark:text-purple-300">Sobre Mí</span>
        </SectionHeading>

        <p class="text-lg leading-relaxed mb-4">
          Soy una desarrolladora web y entusiasta de la inteligencia artificial.
          Me apasiona crear experiencias digitales interactivas y accesibles que
          impacten positivamente a los usuarios.
        </p>

        <p class="text-lg leading-relaxed">
          Manejo tecnologías como
          <strong>Vue, React, Node.js, Python, Django y bases de datos como MongoDB y MySQL</strong>.
          También aplico principios de diseño, patrones SOLID, animaciones con GSAP
          y visuales SVG cuando es necesario.
        </p>
      </div>

      <!-- [Columna ilustración — atom SVG.] -->
      <FemaleDeveloperIllustration />
    </div>
  </section>
</template>
