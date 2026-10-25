// [GUARD][CHAIN-OF-RESPONSIBILITY] verifica token antes de navegar a rutas protegidas.
import { defineNuxtRouteMiddleware, navigateTo, useCookie } from '#app';

export default defineNuxtRouteMiddleware((to) => {
  const accessToken = useCookie<string | null>('access_token');
  if (!accessToken.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
});
