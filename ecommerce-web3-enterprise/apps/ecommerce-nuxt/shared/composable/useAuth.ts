// useAuth.ts (Composable + cookies de Nuxt) => sesión del panel: usuario y roles (solo lectura).
// El login y el logout viven en Next.js (SSO): Nitro copia la sesión de next-auth en estas cookies
// (server/middleware/auth.ts). Patrón Facade (la UI no sabe de cookies) + Observer (las cookies son refs reactivas:
// el menú y los guards se actualizan solos).
import { computed, useCookie } from "#imports";
import { AUTH_COOKIES, PANEL_ROLES, type RoleName, type SessionUser } from "../lib/auth-config";

export function useAuth() {
  const user = useCookie<SessionUser | null>(AUTH_COOKIES.user, { default: () => null });
  const accessToken = useCookie<string | null>(AUTH_COOKIES.access, { default: () => null });

  const isAuthenticated = computed(() => Boolean(user.value)); // computed => se recalcula solo si cambia el usuario
  const hasRole = (...roles: RoleName[]) => roles.some((role) => user.value?.roles.includes(role) ?? false);
  const canUsePanel = computed(() => hasRole(...PANEL_ROLES));

  return { user, accessToken, isAuthenticated, canUsePanel, hasRole };
}
