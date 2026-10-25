// [GUARD][CHAIN-OF-RESPONSIBILITY] exige token + rol ADMIN antes de entrar a /admin/*.
// DRY: centraliza la verificación de rol que antes se repetía en cada página admin.
import { defineNuxtRouteMiddleware, navigateTo } from '#app';
import { useAuthStore } from '~/stores/useAuthStore';

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();

  // Sin token → login, conservando destino.
  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }

  // Carga el perfil si falta para conocer el rol (con refresh como fallback).
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      try {
        await auth.refresh();
        await auth.fetchMe();
      } catch {
        await auth.logout();
        return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
      }
    }
  }

  // Único rol del portafolio. Cualquier otra cosa → fuera del panel.
  if (!auth.isAdmin) {
    return navigateTo('/account');
  }
});
