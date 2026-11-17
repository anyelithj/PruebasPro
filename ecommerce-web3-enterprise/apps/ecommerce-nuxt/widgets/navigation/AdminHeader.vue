<!--
  AdminHeader.vue (widget · Vue 3 + Tailwind) => barra superior del panel, ESPEJO de la de PanelFrame.tsx (Next.js):
  botón de menú (solo móvil: abre el panel; en escritorio se oculta/muestra desde el botón del propio menú, estilo
  Claude/Gemini), ubicación actual desde el manifiesto, accesos a la
  tienda y a notificaciones, y el menú de usuario (UserMenu.vue, sin cambios). Mismas clases y alturas que Next.
  Patrones: Facade (usePanelNav), Composite. Accesibilidad: aria-controls/aria-expanded, migas en <nav> con <ol>.
-->
<script setup lang="ts">
import { usePanelNav } from "./usePanelNav";
import UserMenu from "./UserMenu.vue";
import ThemeToggle from "~~/shared/ui/ThemeToggle.vue";

const { NAV, crumb, text, mobileOpen, nextUrl } = usePanelNav();
const localePath = useLocalePath();
const NAV_BUTTON = "flex size-9 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
    <div class="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4 lg:px-6">
      <!-- lg:hidden => solo móvil/tablet; en escritorio se usa el botón "panel lateral" del menú -->
      <button type="button" aria-controls="panel-sidebar" :aria-expanded="mobileOpen" :class="[NAV_BUTTON, 'lg:hidden']" @click="mobileOpen = !mobileOpen">
        <span class="sr-only">{{ mobileOpen ? text("closeMenu") : text("openMenu") }}</span>
        <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.menu" />
      </button>

      <nav :aria-label="text('breadcrumb')" class="min-w-0 flex-1">
        <p v-if="crumb" class="truncate text-sm font-medium text-slate-500">{{ crumb }}</p>
      </nav>

      <div class="flex shrink-0 items-center gap-1">
        <NuxtLink :to="localePath('/')" :title="text('store')" :class="NAV_BUTTON">
          <span class="sr-only">{{ text("store") }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.store" />
        </NuxtLink>
        <NuxtLink :to="localePath('/cart')" :title="text('cart')" :class="NAV_BUTTON">
          <span class="sr-only">{{ text("cart") }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.cart" />
        </NuxtLink>
        <a :href="nextUrl('/account/notifications')" :title="text('notifications')" :class="NAV_BUTTON">
          <span class="sr-only">{{ text("notifications") }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.bell" />
        </a>
        <ThemeToggle />
        <span class="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <UserMenu />
      </div>
    </div>
  </header>
</template>
