<!--
  [Capa: Pages — entry de ruta "/".]
  [Atomic Design: Template — compone organisms.]
  [SEO/a11y: heading h1 sr-only para landmark, useSeoMeta + JSON-LD Person.]
-->
<script setup lang="ts">
// [vue: useHead/useSeoMeta — composables Nuxt para meta dinámico.]
// [#imports — alias virtual de Nuxt; type-safe.]
import { useHead, useSeoMeta, definePageMeta } from '#imports'

// [Atomic Design: importamos organisms vía facades (sections/*) para mantener compat.]
import Hero from '~/components/sections/Hero.vue'
import About from '~/components/sections/About.vue'
import Projects from '~/components/sections/Projects.vue'
import Skills from '~/components/sections/Skills.vue'
import Contact from '~/components/sections/Contact.vue'
import SocialLinks from '~/components/sections/SocialLinks.vue'

// [SEO: useSeoMeta — DSL específico para meta tags (Open Graph, Twitter, etc.).]
useSeoMeta({
  title: 'Inicio | Portafolio de Juan Pérez',
  description: 'Portafolio profesional de Juan Pérez. Desarrolladora frontend especializada en Vue, Nuxt 3 y TypeScript.',
  ogTitle: 'Portafolio de Juan Pérez',
  ogDescription: 'Explora proyectos y habilidades como desarrolladora frontend con Nuxt 3 y TypeScript.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

// [SEO: JSON-LD structured data — schema.org Person + WebSite.]
useHead({
  htmlAttrs: { lang: 'es' },
  link: [{ rel: 'canonical', href: 'https://juanperez.dev/' }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Juan Pérez',
        url: 'https://juanperez.dev',
        jobTitle: 'Desarrolladora Frontend',
        sameAs: [
          'https://github.com/tu_usuario',
          'https://linkedin.com/in/tu_usuario',
          'https://twitter.com/tu_usuario',
        ],
      }),
    },
  ],
})

// [Nuxt: definePageMeta — metadatos de la ruta. Layout default.]
definePageMeta({
  layout: 'default',
})
</script>

<template>
  <!--
    [a11y: <main id="main-content"> — landmark; coincide con skip-link en layout.]
  -->
  <main id="main-content">
    <!-- [a11y: h1 oculto visualmente pero leído por SR (sr-only).] -->
    <h1 class="sr-only">Portafolio profesional de Juan Pérez</h1>

    <Hero />
    <About />
    <Projects />
    <Skills />
    <Contact />
    <SocialLinks />
  </main>
</template>

<style scoped>
/* [a11y: utility sr-only — sólo screen readers, invisible visualmente.] */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
