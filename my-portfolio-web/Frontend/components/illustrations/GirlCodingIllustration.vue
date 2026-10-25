<template>
  <div ref="svgContainer" class="w-full max-w-md mx-auto animate-fade-in">
    <!-- Ilustración SVG de una chica programadora -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      class="w-full h-auto"
      role="img"
      aria-label="Ilustración de una chica programadora"
    >
      <!-- 🎨 SVG DE EJEMPLO (puedes reemplazarlo por uno más detallado) -->
      <circle cx="250" cy="250" r="200" fill="#F6C1C3" />
      <rect x="190" y="320" width="120" height="40" rx="10" fill="#333" />
      <path d="M200 300 Q250 180 300 300" fill="#A562FF" />
      <circle cx="250" cy="160" r="30" fill="#FED84B" />
      <!-- Fin SVG de ejemplo -->
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { gsap } from 'gsap'

const svgContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (svgContainer.value) {
    gsap.fromTo(
      svgContainer.value,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }
    )
  }
})
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 1s ease-out forwards;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

