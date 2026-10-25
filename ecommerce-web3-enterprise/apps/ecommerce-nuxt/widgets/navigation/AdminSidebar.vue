<!--
  AdminSidebar.vue (widget · Vue 3 + Tailwind) => menú lateral ÚNICO, ESPEJO EXACTO de AdminSidebar.tsx (Next.js): mismo
  diseño "pro sidebar" (fondo oscuro, marca, tarjeta del usuario, buscador, grupos plegables, ítem activo resaltado, riel
  de íconos en escritorio y panel deslizable en móvil), mismas clases, mismo manifiesto y mismas reglas por rol.
  Corrección: antes los ítems de Nuxt se dibujaban con <component :is="resolveComponent('NuxtLink')">; en la plantilla
  "resolveComponent" no existe y salía un elemento sin href (sin cursor de mano y sin navegar). Ahora cada ítem es un
  <NuxtLink> o un <a href> explícito (v-if / v-else).
  Patrones: Composite (grupos -> ítems), Facade (usePanelNav), Observer (watch de la ruta). Accesibilidad: <nav> con
  nombre, acordeón WAI-ARIA, aria-current="page", tooltips en el riel, Escape cierra el panel móvil.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AdminNavItem } from "@ecommerce/shared-types";
import { cn } from "~~/shared/lib/cn";
import { initials, panelHome, usePanelNav } from "./usePanelNav";

const { NAV, locale, groups, active, text, itemHref, collapsed, mobileOpen, user, name, roleLabel, nextUrl } = usePanelNav();
const localePath = useLocalePath();
const route = useRoute();

// Clases compartidas — idénticas a AdminSidebar.tsx. Menú compacto: fila de 28 px (ícono 24 px + 2 px arriba/abajo),
// sobre el mínimo de 24 px de WCAG 2.5.8 (tamaño del objetivo táctil)
const ITEM = "group/item relative flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-0.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";
const ITEM_ACTIVE = "bg-indigo-500/15 text-white";
const ICON_BOX = "flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-400 transition-colors group-hover/item:text-indigo-300";
const ICON_BOX_ACTIVE = "bg-indigo-500 text-white group-hover/item:text-white";
const COLLAPSED_KEY = "admin-sidebar-collapsed";

// Acordeón: el grupo activo se abre solo (watch = Observer de la ruta)
const open = ref(new Set<string>([active.value?.group.key ?? "account"]));
watch(active, (value) => value && !open.value.has(value.group.key) && (open.value = new Set(open.value).add(value.group.key)));
watch(() => route.fullPath, () => (mobileOpen.value = false)); // Al navegar se cierra el panel móvil
const toggleGroup = (key: string) => {
  const next = new Set(open.value);
  if (!next.delete(key)) next.add(key);
  open.value = next;
};

// Buscador sin tildes (NFD + quitar diacríticos)
const query = ref("");
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const searching = computed(() => query.value.trim().length > 0);
const filtered = computed(() => {
  const q = normalize(query.value.trim());
  if (!q) return groups.value;
  return groups.value.map((group) => ({ ...group, items: group.items.filter((item) => normalize(item.label[locale.value]).includes(q)) })).filter((group) => group.items.length > 0);
});
const isActive = (item: AdminNavItem) => active.value?.item.key === item.key;
// homeHref => la marca lleva al inicio del panel según el rol (panelHome: ADMIN resumen, VENDOR catálogo, resto cuenta), en Next
const homeHref = computed(() => nextUrl(panelHome(user.value?.roles ?? [])));

// Preferencia del riel: se lee al montar (solo navegador) y se guarda al cambiar
onMounted(() => {
  try { collapsed.value = localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { /* almacenamiento bloqueado */ }
});
const toggleCollapsed = () => {
  collapsed.value = !collapsed.value;
  try { localStorage.setItem(COLLAPSED_KEY, collapsed.value ? "1" : "0"); } catch { /* sin persistencia */ }
};
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
      <!-- Marca -->
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <a :href="homeHref" :class="cn('flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400', collapsed && 'lg:mx-auto')">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow">W3</span>
          <span :class="cn('truncate font-semibold text-white', collapsed && 'lg:sr-only')">eCommerce Web3</span>
        </a>
        <button type="button" class="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" :aria-label="text('closeMenu')" @click="mobileOpen = false">
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto (repositorio), nunca datos del usuario -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true" v-html="NAV.icons.close" />
        </button>
      </div>

      <!-- Tarjeta del usuario -->
      <div v-if="user" :class="cn('flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4', collapsed && 'lg:justify-center lg:px-0')">
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
        <p v-if="!filtered.length" class="px-3 py-2 text-sm text-slate-500">{{ text("noResults") }}</p>
        <section v-for="group in filtered" :key="group.key" :aria-label="group.label[locale]" :class="cn('mb-0.5', collapsed && 'lg:mb-2 lg:border-t lg:border-white/10 lg:pt-3 lg:first:border-t-0 lg:first:pt-0')">
          <h2 :class="cn(collapsed && 'lg:sr-only')">
            <button type="button" :aria-expanded="collapsed || searching || open.has(group.key)" :aria-controls="`nav-panel-${group.key}`" class="flex w-full cursor-pointer items-center justify-between rounded-md px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" @click="toggleGroup(group.key)">
              {{ group.label[locale] }}
              <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" :class="cn('size-3.5 transition-transform', (collapsed || searching || open.has(group.key)) && 'rotate-180')" aria-hidden="true" v-html="NAV.icons.chevron" />
            </button>
          </h2>
          <!-- Cerrado => clase "hidden": la clase "flex" de Tailwind anula el atributo hidden (por eso antes no se plegaba) -->
          <ul :id="`nav-panel-${group.key}`" :hidden="!(collapsed || searching || open.has(group.key))" :class="cn('flex flex-col gap-px', !(collapsed || searching || open.has(group.key)) && 'hidden')">
            <li v-for="item in group.items" :key="item.key">
              <!-- Ítem de Nuxt => NuxtLink (SPA); ítem de Next => <a href> (otra app). Ambos son enlaces reales -->
              <NuxtLink v-if="item.app === 'nuxt'" :to="itemHref(item)" :title="collapsed ? item.label[locale] : undefined" :aria-current="isActive(item) ? 'page' : undefined" :class="cn(ITEM, collapsed && 'lg:justify-center lg:px-0', isActive(item) && ITEM_ACTIVE)">
                <span v-if="isActive(item)" class="absolute inset-y-1 -left-3 w-1 rounded-r-full bg-indigo-400" aria-hidden="true" />
                <span :class="cn(ICON_BOX, isActive(item) && ICON_BOX_ACTIVE)">
                  <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true" v-html="NAV.icons[item.icon] ?? ''" />
                </span>
                <span :class="cn('truncate', collapsed && 'lg:sr-only')">{{ item.label[locale] }}</span>
              </NuxtLink>
              <a v-else :href="itemHref(item)" :title="collapsed ? item.label[locale] : undefined" :class="cn(ITEM, collapsed && 'lg:justify-center lg:px-0')">
                <span :class="ICON_BOX">
                  <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true" v-html="NAV.icons[item.icon] ?? ''" />
                </span>
                <span :class="cn('truncate', collapsed && 'lg:sr-only')">{{ item.label[locale] }}</span>
              </a>
            </li>
          </ul>
        </section>
      </nav>

      <!-- Pie: tienda + ocultar/mostrar menú -->
      <div :class="cn('flex shrink-0 items-center gap-1 border-t border-white/10 p-3', collapsed && 'lg:flex-col')">
        <NuxtLink :to="localePath('/')" :title="text('store')" :class="cn(ITEM, 'flex-1', collapsed && 'lg:w-full lg:justify-center lg:px-0')">
          <span :class="ICON_BOX">
            <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true" v-html="NAV.icons.store" />
          </span>
          <span :class="cn('truncate', collapsed && 'lg:sr-only')">{{ text("store") }}</span>
        </NuxtLink>
        <button type="button" :aria-pressed="collapsed" aria-controls="panel-sidebar" :title="collapsed ? text('expand') : text('collapse')" class="hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 lg:flex" @click="toggleCollapsed">
          <span class="sr-only">{{ collapsed ? text("expand") : text("collapse") }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" :class="cn('size-4 transition-transform', collapsed && 'rotate-180')" aria-hidden="true" v-html="NAV.icons.collapse" />
        </button>
      </div>
    </aside>
  </div>
</template>
