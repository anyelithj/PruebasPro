// PanelFrame.tsx (Client Component · React + Tailwind) => marco ÚNICO de todas las pantallas con sesión de Next.js
// (panel admin, "Mi cuenta", chatbot y recomendaciones): menú lateral + barra superior + loader + contenido.
// Espejo exacto en Nuxt: layouts/admin.vue + AdminSidebar.vue + AdminHeader.vue + TopLoader.vue.
// Barra superior: botón de menú (abre el panel en móvil / lo oculta en escritorio), migas de pan calculadas desde el
// manifiesto, acceso a la tienda y a las notificaciones, y el menú de usuario (DropdownMenu de Radix, sin cambios).
// Patrones: Mediator (este componente guarda el estado que comparten menú y barra), Composite (slots: children, banner).
// Accesibilidad: <header>/<main id="main-content">, aria-expanded/aria-controls en el botón de menú, migas con <nav>.
"use client"; // Directiva de Next.js: maneja estado y eventos => se ejecuta en el navegador

import { useEffect, useState, type ReactNode } from "react";
import { Link, usePathname } from "@/shared/lib/i18n/navigation";
import { AdminSidebar, NavIcon, storeHref, usePanelNav } from "@/features/admin-dashboard/ui/AdminSidebar";
import UserMenu from "@/widgets/auth/UserMenu"; // Dropdown Menu del usuario: se conserva tal cual
import { TopLoader } from "./TopLoader";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";
import { ChatWidget } from "@/features/ai-chat/ui/ChatWidget";
import { cn } from "@/shared/lib/cn";

const COLLAPSED_KEY = "admin-sidebar-collapsed"; // Preferencia visual por navegador (misma clave en Nuxt)
// Botón redondo de la barra superior (DRY)
const NAV_BUTTON = "flex size-10 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export function PanelFrame({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  const { locale, active, text } = usePanelNav();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // Riel de íconos (escritorio)
  const [mobileOpen, setMobileOpen] = useState(false); // Panel deslizable (móvil)

  // La preferencia se lee en useEffect (no en el render) para no romper la hidratación SSR
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1"); } catch { /* almacenamiento bloqueado => expandido */ }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try { localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1"); } catch { /* sin persistencia, sigue funcionando */ }
      return !value;
    });
  // Botón de menú: en móvil abre el panel; en escritorio (lg = 1024 px) oculta/muestra el riel
  const onMenuButton = () => (window.matchMedia("(min-width: 1024px)").matches ? toggleCollapsed() : setMobileOpen((open) => !open));

  return (
    <div className="min-h-screen bg-slate-50">
      <TopLoader label={text("loading")} />
      <AdminSidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggleCollapsed={toggleCollapsed} onCloseMobile={() => setMobileOpen(false)} />

      {/* Columna de contenido: deja espacio al menú fijo (ancho completo o riel) */}
      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200 motion-reduce:transition-none", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-72")}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <button type="button" onClick={onMenuButton} aria-controls="panel-sidebar" aria-expanded={mobileOpen} className={NAV_BUTTON}>
              <span className="sr-only">{mobileOpen ? text("closeMenu") : text("openMenu")}</span>
              <NavIcon name="menu" className="size-5" />
            </button>

            {/* Migas de pan: Panel › Grupo › Sección (salen del manifiesto; la última es la página actual) */}
            <nav aria-label={text("breadcrumb")} className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-2 text-sm">
                <li className="hidden shrink-0 text-slate-400 sm:block">{text("panel")}</li>
                {active && (
                  <>
                    <li className="hidden shrink-0 text-slate-300 sm:block" aria-hidden="true">/</li>
                    <li className="hidden shrink-0 text-slate-500 md:block">{active.group.label[locale]}</li>
                    <li className="hidden shrink-0 text-slate-300 md:block" aria-hidden="true">/</li>
                    <li className="truncate font-semibold text-slate-900" aria-current="page">{active.item.label[locale]}</li>
                  </>
                )}
              </ol>
            </nav>

            <div className="flex shrink-0 items-center gap-1">
              <a href={storeHref(locale)} title={text("store")} className={NAV_BUTTON}>
                <span className="sr-only">{text("store")}</span>
                <NavIcon name="store" className="size-5" />
              </a>
              {/* Carrito: vive en la tienda (Nuxt), misma sesión por SSO */}
              <a href={`${storeHref(locale)}/cart`} title={text("cart")} className={NAV_BUTTON}>
                <span className="sr-only">{text("cart")}</span>
                <NavIcon name="cart" className="size-5" />
              </a>
              <Link href="/account/notifications" title={text("notifications")} className={NAV_BUTTON}>
                <span className="sr-only">{text("notifications")}</span>
                <NavIcon name="bell" className="size-5" />
              </Link>
              <ThemeToggle labels={{ dark: text("themeDark"), light: text("themeLight") }} />
              <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
              <UserMenu />
            </div>
          </div>
        </header>

        {banner}
        {/* id="main-content" => destino del enlace "Saltar al contenido" del layout raíz (WCAG 2.4.1) */}
        <main id="main-content" className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-1 flex-col gap-6 p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Chat flotante del asistente IA (ventana propia); oculto dentro de la página /chat */}
      {!pathname.startsWith("/chat") && <ChatWidget />}
    </div>
  );
}
