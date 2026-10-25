<!--
  AdminHeader.vue (widget · Vue 3 + Tailwind) => barra superior del panel, ESPEJO de la de PanelFrame.tsx (Next.js):
  botón de menú (abre el panel en móvil / oculta el riel en escritorio), migas de pan desde el manifiesto, accesos a la
  tienda y a notificaciones, y el menú de usuario (UserMenu.vue, sin cambios). Mismas clases y alturas que Next.
  Patrones: Facade (usePanelNav), Composite. Accesibilidad: aria-controls/aria-expanded, migas en <nav> con <ol>.
-->
<script setup lang="ts">
import { usePanelNav } from "./usePanelNav";
import UserMenu from "./UserMenu.vue";
import ThemeToggle from "~~/shared/ui/ThemeToggle.vue";

const { NAV, locale, active, text, collapsed, mobileOpen, nextUrl } = usePanelNav();
const localePath = useLocalePath();
const COLLAPSED_KEY = "admin-sidebar-collapsed";
const NAV_BUTTON = "flex size-10 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

// onMenuButton => móvil: abre/cierra el panel; escritorio (lg = 1024 px): oculta/muestra el riel (y lo recuerda)
const onMenuButton = () => {
  if (!window.matchMedia("(min-width: 1024px)").matches) return void (mobileOpen.value = !mobileOpen.value);
  collapsed.value = !collapsed.value;
  try { localStorage.setItem(COLLAPSED_KEY, collapsed.value ? "1" : "0"); } catch { /* sin persistencia */ }
};
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
    <div class="flex h-16 items-center gap-3 px-4 lg:px-6">
      <button type="button" aria-controls="panel-sidebar" :aria-expanded="mobileOpen" :class="NAV_BUTTON" @click="onMenuButton">
        <span class="sr-only">{{ mobileOpen ? text("closeMenu") : text("openMenu") }}</span>
        <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.menu" />
      </button>

      <!-- Migas de pan: Panel / Grupo / Sección -->
      <nav :aria-label="text('breadcrumb')" class="min-w-0 flex-1">
        <ol class="flex min-w-0 items-center gap-2 text-sm">
          <li class="hidden shrink-0 text-slate-400 sm:block">{{ text("panel") }}</li>
          <template v-if="active">
            <li class="hidden shrink-0 text-slate-300 sm:block" aria-hidden="true">/</li>
            <li class="hidden shrink-0 text-slate-500 md:block">{{ active.group.label[locale] }}</li>
            <li class="hidden shrink-0 text-slate-300 md:block" aria-hidden="true">/</li>
            <li class="truncate font-semibold text-slate-900" aria-current="page">{{ active.item.label[locale] }}</li>
          </template>
        </ol>
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
