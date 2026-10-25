// usePanelNav.ts (Composable de Vue/Nuxt) => estado y datos que comparten el menú lateral (AdminSidebar.vue) y la barra
// superior (AdminHeader.vue). Espejo de usePanelNav() de Next.js (AdminSidebar.tsx): mismas reglas de visibilidad por
// rol, mismo cálculo del ítem activo y mismos textos (salen del manifiesto compartido admin-nav.json).
// Patrones: Facade (oculta manifiesto + sesión + ruta), Singleton por petición (useState de Nuxt: un estado compartido),
// Adapter (itemHref traduce un ítem a URL de Nuxt o de Next).
import { computed } from "vue";
import { useI18n, useLocalePath, useRoute, useRuntimeConfig, useState } from "#imports";
import type { AdminLocale, AdminNav, AdminNavGroup, AdminNavItem, AdminNavText } from "@ecommerce/shared-types";
import navData from "@ecommerce/shared-types/admin-nav.json";
import { useAuth } from "~~/shared/composable/useAuth";
import { nextAppUrl } from "~~/shared/constants/config";

export const NAV = navData as AdminNav; // JSON tipado con el contrato compartido

// navVisible => misma regla que Next: "account" para toda sesión; ADMIN todo; VENDOR además todo ítem sin adminOnly
const navVisible = (group: AdminNavGroup, item: AdminNavItem, roles: readonly string[]) =>
  group.key === "account" || roles.includes("ADMIN") || (roles.includes("VENDOR") && !item.adminOnly);

// panelHome => inicio según el rol (misma regla que Next): ADMIN y VENDOR => portada del panel (cada uno ve SU
// resumen), el resto => su cuenta
export const panelHome = (roles: readonly string[]) => (roles.includes("ADMIN") || roles.includes("VENDOR") ? "/dashboard" : "/account");

// matchLength => cuánto de la URL coincide con el ítem; gana la coincidencia más larga
const matchLength = (item: AdminNavItem, path: string) =>
  Math.max(0, ...[item.path, ...(item.match ?? [])].map((prefix) => (path === prefix || path.startsWith(`${prefix}/`) || (prefix.endsWith("-") && path.startsWith(prefix)) ? prefix.length : 0)));

// initials => "Ana María Pérez" -> "AP" — función pura
export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
};

export function usePanelNav() {
  const route = useRoute();
  const localePath = useLocalePath();
  const { locale: i18nLocale } = useI18n();
  const { user } = useAuth();
  const { public: runtime } = useRuntimeConfig();

  // useState (Nuxt) => estado compartido entre componentes y seguro en SSR; misma preferencia que en Next
  const collapsed = useState("panel-collapsed", () => false);
  const mobileOpen = useState("panel-mobile-open", () => false);

  const locale = computed<AdminLocale>(() => (i18nLocale.value === "en" ? "en" : "es"));
  const pathNoLocale = computed(() => route.path.replace(/^\/en(?=\/|$)/, "") || "/"); // "/en/cms-page" -> "/cms-page"
  const roles = computed(() => user.value?.roles ?? []);
  const groups = computed(() => NAV.groups.map((group) => ({ ...group, items: group.items.filter((item) => navVisible(group, item, roles.value)) })).filter((group) => group.items.length > 0));
  // Ítem activo: solo los de Nuxt (los de Next viven en otra app)
  const active = computed(() => {
    let best: { group: AdminNavGroup; item: AdminNavItem; score: number } | null = null;
    for (const group of groups.value) for (const item of group.items) {
      const score = item.app === "nuxt" ? matchLength(item, pathNoLocale.value) : 0;
      if (score > (best?.score ?? 0)) best = { group, item, score };
    }
    return best;
  });
  const text = (key: AdminNavText) => NAV.text[key][locale.value];
  const storefront = runtime.storefrontUrl as string;
  // itemHref => Nuxt: ruta local con idioma; Next: URL absoluta (otra app, misma sesión por SSO)
  const itemHref = (item: AdminNavItem) => (item.app === "nuxt" ? localePath(item.path) : nextAppUrl(storefront, locale.value, item.path));
  const name = computed(() => (user.value ? `${user.value.firstName} ${user.value.lastName}`.trim() : ""));
  const roleLabel = computed(() => roles.value.map((role) => NAV.roles[role]?.[locale.value] ?? role)[0] ?? "");

  return { NAV, locale, groups, active, text, itemHref, collapsed, mobileOpen, user, name, roleLabel, storefront, nextUrl: (path: string) => nextAppUrl(storefront, locale.value, path) };
}
