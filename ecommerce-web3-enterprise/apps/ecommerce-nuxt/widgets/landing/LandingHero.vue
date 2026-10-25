<!--
  LandingHero.vue (widget, Composite) => compone la landing completa: hero (feature landing), contenido visual del
  CMS (GrapesJS renderizado en SSR), testimonios y formulario de captura de leads. La página solo pasa los datos.
-->
<script setup lang="ts">
import type { Landing } from "~~/entities/landing/model/landing.types";
import HeroSection from "~~/features/landing/ui/HeroSection.vue";
import TestimonialSlider from "~~/features/landing/ui/TestimonialSlider.vue";
import LeadCaptureForm from "~~/features/landing/ui/LeadCaptureForm.vue";
import CMSBlockRenderer from "~~/features/cms/ui/CMSBlockRenderer.vue";

defineProps<{ landing: Landing }>();
</script>

<template>
  <article>
    <HeroSection :landing="landing" />
    <div class="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12">
      <CMSBlockRenderer v-if="landing.body.html" :html="landing.body.html" :css="landing.body.css" />
      <TestimonialSlider :testimonials="landing.data.testimonials ?? []" />
      <div class="mx-auto w-full max-w-lg"><LeadCaptureForm :slug="landing.slug" /></div>
    </div>
  </article>
</template>
