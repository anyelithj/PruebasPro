import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { initialsFromName, ROLE_GRADIENT, toPortalRole } from "@/components/portal/portal-role";
import { PortalTopbar } from "@/components/portal/PortalTopbar";
import { PreferencesProvider } from "@/components/layout/PreferencesProvider";
import { cookies } from "next/headers"; // [Next.js]: cookies de la petición (solo en el servidor)
import { MobileNavProvider, PortalFrame } from "@/components/portal/MobileNav";
import { SIDEBAR_COOKIE } from "@/lib/constants"; // [Menú]: hamburguesa (móvil) + ocultar sidebar (escritorio)
import { displayNameFromEmail, getCurrentUserPayload } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { getDictionary } from "@aula/shared-i18n";
import { AngularElements } from "@/components/shared/AngularElements"; // [Sprint 7.11]: carga el remoto Angular para <aula-guia-widget>
import { Toaster } from "@/components/shared/Toaster"; // [2026-10-19]: avisos «guardado / editado / eliminado» (también los de los Angular Elements)
// [Portal Layout]: server component, deriva rol + displayName del JWT e idioma de la cookie | [Patrón]: Container + Provider | [Principio]: SSOT

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // `Promise.all` (ES2015): lee sesión e idioma en paralelo (ambos son lecturas de cookies, sin red)
  const [payload, locale, jar] = await Promise.all([getCurrentUserPayload(), getLocale(), cookies()]);
  const sidebarCollapsed = jar.get(SIDEBAR_COOKIE)?.value === "1"; // Preferencia guardada → sin parpadeo al cargar
  const role = toPortalRole(payload?.role ?? null);
  const displayName = payload ? displayNameFromEmail(payload.email) : undefined;
  const t = getDictionary(locale);
  const name = displayName ?? t.roles[role];
  // [Usuario del topbar]: todo derivado en el servidor desde el JWT (sin petición extra) | [Principio]: SSOT
  const user = { name, email: payload?.email ?? "", roleLabel: t.roles[role], initials: initialsFromName(name), gradient: ROLE_GRADIENT[role] };
  return (
    // [PreferencesProvider]: idioma + tema disponibles para todos los Client Components del portal | [Patrón]: Provider
    <PreferencesProvider initialLocale={locale}>
      {/* [MobileNavProvider]: el botón hamburguesa (topbar) abre el sidebar (drawer) en pantallas < lg | [Patrón]: Provider */}
      <MobileNavProvider initialCollapsed={sidebarCollapsed}>
        {/* [Responsive]: sidebar fijo en columna desde lg (≥1024px); por debajo es un drawer → el contenido usa todo el ancho en móvil y tablet */}
        <PortalFrame>
          <PortalSidebar role={role} displayName={displayName} />
          <main id="main-content" className="flex min-w-0 flex-col px-4 pb-10 md:px-8">
            {/* [Barra superior global]: hamburguesa (móvil), buscador, notificaciones, carrito, tema, idioma y perfil */}
            <PortalTopbar user={user} />
            {children}
          </main>
        </PortalFrame>
        {/* [Agente Guía · Sprint 7.11]: Angular Element flotante en todas las páginas del portal (mismo componente que el marco de Angular) */}
        <aula-guia-widget />
        <AngularElements />
        <Toaster />
      </MobileNavProvider>
    </PreferencesProvider>
  );
}
