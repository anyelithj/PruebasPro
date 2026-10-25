<!--
  [Atomic Design: Template — layout base con Navbar, slot y Footer.]
  [a11y: skip-link visible al focus (Tab) → permite saltar al contenido (WCAG 2.4.1).]
-->
<script setup lang="ts">
import Navbar from '~/components/layout/Navbar.vue'
import Footer from '~/components/layout/Footer.vue'
// [Chat IA flotante — global en todas las páginas con este layout.]
import ChatWidget from '~/components/organisms/ChatWidget.vue'
// [Tema scoped: aplica `.dark` solo en #about, #projects, #skills, #contact.]
import { useScopedTheme } from '~/composables/useScopedTheme'

useScopedTheme()
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
    <!--
      [a11y: skip-link — invisible hasta focus. WCAG 2.4.1 Bypass Blocks.]
      [Salta directamente a #main-content (definido en pages/index.vue).]
    -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]
             focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
    >
      Saltar al contenido principal
    </a>

    <Navbar />

    <main class="pt-20 flex-1">
      <slot />
    </main>

    <Footer />
    <ChatWidget />
  </div>
</template>

<style scoped>
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
.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
</style>
