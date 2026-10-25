<!--
  TestimonialSlider.vue (Vue 3 + CSS scroll-snap) => carrusel de testimonios SIN librerías (reemplaza Swiper, ~40 KB):
  el navegador hace el desplazamiento y el "encaje" (scroll-snap); los botones solo llaman a scrollBy.
  Accesibilidad: región con nombre, cada testimonio es <figure>/<blockquote>, botones con texto y la lista también se
  recorre con teclado/scroll táctil. Sin reproducción automática (WCAG 2.2.2) y sin trabajo en segundo plano.
-->
<script setup lang="ts">
import { ref } from "vue";
import type { Testimonial } from "~~/entities/landing/model/landing.types";

defineProps<{ testimonials: Testimonial[] }>();
const track = ref<HTMLElement | null>(null);
// scroll => desplaza una "página" (el ancho visible); "smooth" se anula con prefers-reduced-motion (CSS)
const scroll = (direction: 1 | -1) => track.value?.scrollBy({ left: direction * track.value.clientWidth, behavior: "smooth" });
</script>

<template>
  <section v-if="testimonials.length" :aria-label="$t('landing.testimonials')" class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-semibold">{{ $t("landing.testimonials") }}</h2>
      <div class="flex gap-2">
        <button type="button" class="size-10 rounded-full border hover:bg-slate-50" :aria-label="$t('common.previous')" @click="scroll(-1)">‹</button>
        <button type="button" class="size-10 rounded-full border hover:bg-slate-50" :aria-label="$t('common.next')" @click="scroll(1)">›</button>
      </div>
    </div>
    <ul ref="track" class="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 motion-reduce:scroll-auto" tabindex="0">
      <li v-for="(item, index) in testimonials" :key="index" class="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)]">
        <figure class="flex h-full flex-col gap-3 rounded-lg border bg-white p-5">
          <blockquote class="text-base text-slate-700">“{{ item.quote }}”</blockquote>
          <figcaption class="text-sm font-medium text-slate-900">— {{ item.author }}</figcaption>
        </figure>
      </li>
    </ul>
  </section>
</template>
