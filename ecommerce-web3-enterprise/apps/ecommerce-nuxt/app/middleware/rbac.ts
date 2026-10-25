// rbac.ts (route middleware de Nuxt) => control de acceso por rol (Role-Based Access Control, patrón Guard).
// Lee los roles permitidos de definePageMeta({ roles: [...] }); por defecto, los del panel (ADMIN y VENDOR).
// Sin permiso => 403 real (createError): la página no se renderiza ni filtra datos.
import { useAuth } from "~~/shared/composable/useAuth";
import { PANEL_ROLES, type RoleName } from "~~/shared/lib/auth-config";

export default defineNuxtRouteMiddleware((to) => {
  const { hasRole } = useAuth();
  // "as" => meta de vue-router es genérico; definePageMeta ya lo tipa en las páginas (nuxt.types.ts)
  const allowed = (to.meta.roles as RoleName[] | undefined) ?? PANEL_ROLES;
  if (!hasRole(...allowed)) return abortNavigation(createError({ statusCode: 403, statusMessage: "Forbidden" }));
});
