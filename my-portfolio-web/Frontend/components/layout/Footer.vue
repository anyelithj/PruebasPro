<!-- <template>
  <footer class="p-4 text-center text-sm text-gray-500">
    © {{ new Date().getFullYear() }} Mi Portafolio. Todos los derechos reservados.
  </footer>
</template> -->
<!-- <template>
  <footer class="bg-gray-800 text-white py-6">
    <div class="container mx-auto text-center">
      <div class="max-w-4xl mx-auto space-y-6">
        <SocialLinks />
      </div>
      <p class="text-sm"> © {{ new Date().getFullYear() }} Mi Portafolio. Todos los derechos reservados.</p>
    </div>
    Botón de scroll hacia arriba
    <button @click="scrollToTop"
      class="fixed bottom-4 right-4 bg-teal-500 text-white p-2 rounded-full shadow-lg hover:bg-teal-600 transition border-4 border-teal-400"
      style="aspect-ratio: 1/1; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;"
      aria-label="Ir al inicio">
      <font-awesome-icon :icon="['fas', 'arrow-up']" size="lg" />
    </button>
  </footer>
</template>
<script setup lang="ts">
// import SocialLinks from '@/components/sections/SocialLinks.vue'
// function scrollToTop() {
//   window.scrollTo({ top: 0, behavior: 'smooth' })
// }
</script>
<style scoped>
/* footer {
  font-family: 'Inter', sans-serif;
} */
</style> -->

<template>
  <footer class="w-full border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center text-center">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        © {{ currentYear }} TuNombre. Todos los derechos reservados.
      </p>

      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Construido con ❤️ usando Nuxt 3, TailwindCSS y pasión por la Web.
      </p>

      <!-- [DX] acceso al panel de salud de los backends (Nest + FastAPI). -->
      <NuxtLink
        to="/api-status"
        class="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-gray-500 transition
               hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
      >
        <span class="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        Estado de los backends
      </NuxtLink>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>
