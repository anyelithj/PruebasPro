<!--
  [Atomic Design: Organism — sección Contact.]
  [Patrón Vue: Container — envuelve la molecule ContactForm.]
  [SEO/a11y: aria-labelledby + heading id.]
-->
<script setup lang="ts">
import SectionHeading from '~/components/atoms/SectionHeading.vue'
import ContactForm from '~/components/molecules/ContactForm.vue'
</script>

<template>
  <section
    id="contact"
    aria-labelledby="contact-heading"
    class="py-16 px-4 bg-white dark:bg-gray-900"
  >
    <div class="max-w-xl mx-auto p-6 sm:p-8 rounded-xl shadow-md bg-white dark:bg-gray-800 transition-colors">
      <SectionHeading id="contact-heading" :icon="['fas', 'envelope']">
        Contáctame
      </SectionHeading>

      <ContactForm />
    </div>
  </section>
</template>
