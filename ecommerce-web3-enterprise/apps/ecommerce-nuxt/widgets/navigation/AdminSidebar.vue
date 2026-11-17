<!--
  AdminSidebar.vue (widget · Vue 3 + Tailwind) => menú lateral ÚNICO, ESPEJO EXACTO de AdminSidebar.tsx (Next.js): mismo
  diseño "pro sidebar" (fondo oscuro, marca, tarjeta del usuario, buscador, una fila por sección
  —lo de adentro son las pestañas de PanelTabs, sin scroll—, sección activa resaltada, riel de íconos en escritorio y panel deslizable en
  móvil), mismas clases, mismo manifiesto y mismas reglas por rol. Botón ocultar/mostrar estilo Claude/Gemini: ícono
  "panel lateral" arriba, junto a la marca (expandido) o solo en el riel (colapsado).
  Corrección: antes los ítems de Nuxt se dibujaban con <component :is="resolveComponent('NuxtLink')">; en la plantilla
  "resolveComponent" no existe y salía un elemento sin href (sin cursor de mano y sin navegar). Ahora cada ítem es un
  <NuxtLink> o un <a href> explícito (v-if / v-else).
  Patrones: Composite (grupos -> ítems), Facade (usePanelNav), Observer (watch de la ruta). Accesibilidad: <nav> con
  nombre, acordeón WAI-ARIA, aria-current="page", tooltips en el riel, Escape cierra el panel móvil.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NuxtLink } from "#components";
import { cn } from "~~/shared/lib/cn";
import { COLLAPSED_KEY, initials, panelHome, usePanelNav } from "./usePanelNav";

const { NAV, locale, groups, active, text, itemHref, collapsed, mobileOpen, toggleCollapsed, user, name, roleLabel, nextUrl } = usePanelNav();
const localePath = useLocalePath();
const route = useRoute();

// Clases compartidas — idénticas a AdminSidebar.tsx. Menú compacto: fila de 28 px (ícono 24 px + 2 px arriba/abajo),
// sobre el mínimo de 24 px de WCAG 2.5.8 (tamaño del objetivo táctil)
const ITEM = "group/item relative flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";
const ITEM_ACTIVE = "bg-indigo-500/15 text-white";
const ICON_BOX = "flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-400 transition-colors group-hover/item:text-indigo-300";
const ICON_BOX_ACTIVE = "bg-indigo-500 text-white group-hover/item:text-white";
// Botón "panel lateral" (36 px, como Claude/Gemini): mismo estilo en escritorio (ocultar/mostrar) y móvil (cerrar)
const SIDEBAR_TOGGLE = "size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";

watch(() => route.fullPath, () => (mobileOpen.value = false)); // Al navegar se cierra el panel móvil

// Buscador sin tildes (NFD + quitar diacríticos)
const query = ref("");
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const searching = computed(() => query.value.trim().length > 0);
// Encuentra pestañas de cualquier sección, también por "keywords" (igual que Next)
const results = computed(() => {
  const q = normalize(query.value.trim());
  if (!q) return [];
  return groups.value.flatMap((group) => group.items.filter((item) => normalize(`${group.label[locale.value]} ${item.label[locale.value]} ${item.keywords ?? ""}`).includes(q)));
});
// rows => filas del menú: una por sección (va a su primer ítem visible) o, al buscar, un resultado por pestaña
const rows = computed(() =>
  searching.value
    ? results.value.map((item) => ({ key: item.key, item, label: item.label[locale.value], icon: item.icon, isActive: active.value?.item.key === item.key }))
    : groups.value.flatMap((group) => (group.items[0] ? [{ key: group.key, item: group.items[0], label: group.label[locale.value], icon: group.icon, isActive: active.value?.group.key === group.key }] : []))
);
// homeHref => la marca lleva al inicio del panel según el rol (panelHome: ADMIN resumen, VENDOR catálogo, resto cuenta), en Next
const homeHref = computed(() => nextUrl(panelHome(user.value?.roles ?? [])));

// Preferencia del riel: se lee al montar (solo navegador); toggleCollapsed (usePanelNav) la guarda al cambiar
onMounted(() => {
  try { collapsed.value = localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { /* almacenamiento bloqueado */ }
});
</script>

<template>
  <div>
    <!-- Fondo del panel móvil: clic fuera cierra -->
    <div :class="cn('fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity lg:hidden', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')" aria-hidden="true" @click="mobileOpen = false" />
    <aside
      id="panel-sidebar"
      :class="cn('scale-fixed fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-300 shadow-xl transition-[width,transform] duration-200 ease-out motion-reduce:transition-none lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-[4.5rem]' : 'lg:w-72')"
      @keydown.esc="mobileOpen = false"
    >
      <!-- Marca + botón ocultar/mostrar (estilo Claude/Gemini): expandido => marca y botón "panel lateral" a la derecha;
           colapsado (riel) => solo el botón, centrado, en el mismo lugar -->
      <div :class="cn('flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4', collapsed && 'lg:justify-center lg:px-0')">
        <a :href="homeHref" :class="cn('flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400', collapsed && 'lg:hidden')">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow">W3</span>
          <span class="truncate font-semibold text-white">eCommerce Web3</span>
        </a>
        <!-- aria-expanded => estado del menú para lectores de pantalla; title => tooltip nativo -->
        <button type="button" :aria-expanded="!collapsed" aria-controls="panel-sidebar" :title="collapsed ? text('expand') : text('collapse')" :class="cn(SIDEBAR_TOGGLE, 'ml-auto hidden lg:flex', collapsed && 'lg:ml-0')" @click="toggleCollapsed">
          <span class="sr-only">{{ collapsed ? text("expand") : text("collapse") }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto (repositorio), nunca datos del usuario -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.sidebar" />
        </button>
        <button type="button" :class="cn(SIDEBAR_TOGGLE, 'ml-auto flex lg:hidden')" :aria-label="text('closeMenu')" @click="mobileOpen = false">
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.sidebar" />
        </button>
      </div>

      <!-- Tarjeta del usuario -->
      <div v-if="user" :class="cn('flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3', collapsed && 'lg:justify-center lg:px-0')">
        <span class="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-200" :title="collapsed ? name : undefined">
          {{ initials(name) }}
          <span class="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" aria-hidden="true" />
        </span>
        <div :class="cn('min-w-0', collapsed && 'lg:sr-only')">
          <p class="truncate text-sm font-medium text-white">{{ name }}</p>
          <p class="truncate text-xs text-slate-400">{{ roleLabel }} · <span class="text-emerald-400">{{ text("online") }}</span></p>
        </div>
      </div>

      <!-- Buscador del menú -->
      <div role="search" :class="cn('shrink-0 px-3 pt-3', collapsed && 'lg:hidden')">
        <label class="relative block">
          <span class="sr-only">{{ text("search") }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" v-html="NAV.icons.search" />
          <input v-model="query" type="search" :placeholder="text('search')" class="h-9 w-full rounded-md border border-transparent bg-slate-800 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none" >
        </label>
      </div>

      <nav :aria-label="text('menu')" class="flex-1 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-color:theme(colors.slate.700)_transparent] [scrollbar-width:thin]">
        <p v-if="searching && !rows.length" class="px-3 py-2 text-sm text-slate-500">{{ text("noResults") }}</p>
        <!-- Una sección = un enlace; lo de adentro son las pestañas de PanelTabs (regla única, sin desplegables aquí) -->
        <ul class="flex flex-col gap-px">
          <li v-for="row in rows" :key="row.key">
            <!-- Ítem de Nuxt => NuxtLink (SPA); ítem de Next => <a href> (otra app). Ambos son enlaces reales -->
            <component :is="row.item.app === 'nuxt' ? NuxtLink : 'a'" v-bind="row.item.app === 'nuxt' ? { to: itemHref(row.item) } : { href: itemHref(row.item) }" :title="collapsed ? row.label : undefined" :aria-current="row.isActive ? 'page' : undefined" :class="cn(ITEM, collapsed && 'lg:justify-center lg:px-0', row.isActive && ITEM_ACTIVE)">
              <span v-if="row.isActive" class="absolute inset-y-1 -left-3 w-1 rounded-r-full bg-indigo-400" aria-hidden="true" />
              <span :class="cn(ICON_BOX, row.isActive && ICON_BOX_ACTIVE)">
                <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true" v-html="NAV.icons[row.icon] ?? ''" />
              </span>
              <span :class="cn('truncate', collapsed && 'lg:sr-only')">{{ row.label }}</span>
            </component>
          </li>
        </ul>
      </nav>

      <!-- Pie: volver a la tienda (el botón ocultar/mostrar vive arriba, junto a la marca) -->
      <div class="flex shrink-0 items-center border-t border-white/10 p-3">
        <NuxtLink :to="localePath('/')" :title="collapsed ? text('store') : undefined" :class="cn(ITEM, 'flex-1', collapsed && 'lg:justify-center lg:px-0')">
          <span :class="ICON_BOX">
            <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true" v-html="NAV.icons.store" />
          </span>
          <span :class="cn('truncate', collapsed && 'lg:sr-only')">{{ text("store") }}</span>
        </NuxtLink>
      </div>
    </aside>
  </div>
</template>
