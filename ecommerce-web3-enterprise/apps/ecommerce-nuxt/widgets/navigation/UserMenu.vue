<!--
  UserMenu.vue (widget · Vue 3 + Tailwind) => menú de cuenta del panel, ESPEJO de UserMenu.tsx (Next.js + Radix):
  mismo botón (avatar con iniciales + nombre + chevron), mismo panel desplegable, mismos enlaces e íconos.
  Las secciones de cuenta y el cierre de sesión viven en Next.js (login único / SSO) => enlaces <a> normales.
  Patrones: Composite (LINKS como datos), Observer (listener global que cierra al hacer clic fuera).
  Accesibilidad: patrón "menu button" WAI-ARIA (aria-haspopup, aria-expanded, role="menu"/"menuitem"), Escape cierra
  y devuelve el foco al botón; foco visible en cada opción.
-->
<script setup lang="ts">
import { useAuth } from "~~/shared/composable/useAuth";
import { nextAppUrl } from "~~/shared/constants/config";
import { panelHome } from "~~/widgets/navigation/usePanelNav"; // Inicio del panel por rol (misma regla que Next)

const { user, canUsePanel } = useAuth(); // canUsePanel => ADMIN o VENDOR (PANEL_ROLES)
const { locale } = useI18n();
const { public: runtime } = useRuntimeConfig();
const next = (path: string) => nextAppUrl(runtime.storefrontUrl as string, locale.value, path); // URL en Next.js con idioma

// LINKS => mismas rutas, textos e íconos (trazos SVG 24x24) que UserMenu.tsx; "as const" => tupla de solo lectura
const LINKS = [
  { path: "/account", key: "account", icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
  { path: "/account/orders", key: "orders", icon: '<path d="M3 7h18l-2 13H5L3 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/>' },
  { path: "/account/wishlist", key: "wishlist", icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>' },
  { path: "/account/loyalty", key: "loyalty", icon: '<circle cx="12" cy="9" r="6"/><path d="m9 14-1 7 4-2 4 2-1-7"/>' },
  { path: "/recommendations", key: "recommendations", icon: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z"/>' },
  { path: "/chat", key: "assistant", icon: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12Z"/>' },
] as const;
const ITEM = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors focus-visible:bg-slate-100";

// "computed" => nombre completo e iniciales derivados del usuario de la cookie SSO
const name = computed(() => (user.value ? `${user.value.firstName} ${user.value.lastName}`.trim() : ""));
const initials = computed(() => name.value.split(/\s+/).filter(Boolean).map((part, index, parts) => (index === 0 || index === parts.length - 1 ? part[0] : "")).join("").toUpperCase());

const open = ref(false);
const root = ref<HTMLElement | null>(null); // "ref" de plantilla => elemento DOM del menú
const trigger = ref<HTMLButtonElement | null>(null);
const close = (focus = false) => {
  open.value = false;
  if (focus) trigger.value?.focus(); // Al cerrar con Escape el foco vuelve al botón (WCAG 2.4.3)
};
// onDocument => clic fuera del menú lo cierra (listener global registrado solo en el navegador)
const onDocument = (event: MouseEvent) => root.value && !root.value.contains(event.target as Node) && close();
onMounted(() => document.addEventListener("click", onDocument));
onBeforeUnmount(() => document.removeEventListener("click", onDocument)); // Limpieza: sin fugas de memoria
</script>

<template>
  <div v-if="user" ref="root" class="relative" @keydown.esc="close(true)">
    <button ref="trigger" type="button" :aria-label="$t('admin.userMenu.label')" aria-haspopup="menu" :aria-expanded="open" :class="['group flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-accent', open && 'bg-slate-100']" @click="open = !open">
      <span role="img" :aria-label="name" class="inline-flex size-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-slate-50">{{ initials }}</span>
      <span class="hidden max-w-[8rem] truncate text-sm font-medium text-slate-900 md:inline">{{ user.firstName }}</span>
      <svg viewBox="0 0 20 20" fill="currentColor" :class="['hidden size-4 text-slate-500 transition-transform md:block', open && 'rotate-180']" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
      </svg>
    </button>
    <!-- Panel: mismas medidas, borde y sombra que DropdownMenu.Content de Next -->
    <div v-show="open" role="menu" class="absolute right-0 z-50 mt-2 w-64 rounded-lg border bg-white p-1 shadow-lg">
      <div class="flex items-center gap-3 px-2.5 py-2">
        <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-slate-50" aria-hidden="true">{{ initials }}</span>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-slate-900">{{ name }}</p>
          <p class="truncate text-xs text-slate-500">{{ user.email }}</p>
        </div>
      </div>
      <div class="-mx-1 my-1 h-px bg-slate-200" role="separator" />
      <!-- Roles de panel (ADMIN y VENDOR): acceso directo a SU inicio del panel (panelHome), igual que UserMenu.tsx de Next -->
      <a v-if="canUsePanel" role="menuitem" :href="next(panelHome(user.roles))" :class="[ITEM, 'font-medium text-slate-900 hover:bg-slate-100']">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 text-slate-500" aria-hidden="true"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" /></svg>
        {{ $t("admin.userMenu.dashboard") }}
      </a>
      <a v-for="link in LINKS" :key="link.key" role="menuitem" :href="next(link.path)" :class="[ITEM, 'text-slate-900 hover:bg-slate-100']">
        <!-- eslint-disable-next-line vue/no-v-html -- trazos SVG constantes de este archivo (LINKS) -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 text-slate-500" aria-hidden="true" v-html="link.icon" />
        {{ $t(`admin.userMenu.${link.key}`) }}
      </a>
      <div class="-mx-1 my-1 h-px bg-slate-200" role="separator" />
      <!-- Cierre de sesión ÚNICO: lo resuelve next-auth en Next.js (revoca también la sesión del backend) -->
      <a role="menuitem" :href="`${runtime.storefrontUrl}/api/logout`" :class="[ITEM, 'text-red-700 hover:bg-red-50']">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="m10 17-5-5 5-5" /><path d="M5 12h11" /></svg>
        {{ $t("admin.userMenu.signOut") }}
      </a>
    </div>
  </div>
</template>
