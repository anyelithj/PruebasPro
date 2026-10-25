// auth.ts (route middleware de Nuxt, con nombre) => exige sesión para entrar a la página (patrón Guard).
// Sin sesión => al login ÚNICO de Next.js (SSO): tras entrar, el panel admin de Next enlaza de vuelta al de contenido.
// Es una capa de UX: Express vuelve a validar el JWT en cada petición (la seguridad real está en el backend).
import { useAuth } from "~~/shared/composable/useAuth";
import { storeLoginUrl } from "~~/shared/constants/config";

export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated.value) return;
  return navigateTo(storeLoginUrl(useRuntimeConfig().public.storefrontUrl, useNuxtApp().$i18n.locale.value), { external: true });
});
