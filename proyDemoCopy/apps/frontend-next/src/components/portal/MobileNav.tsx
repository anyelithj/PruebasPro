"use client"; // [Next.js]: Client Component → estado compartido del menú móvil
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { usePreferences } from "@/components/layout/PreferencesProvider";
// [MobileNav]: estado abierto/cerrado del sidebar en pantallas < lg, compartido entre el botón hamburguesa (topbar) y el drawer (sidebar)
// [Patrón]: Provider (Context API) + Custom Hook | [Principio]: SRP + DIP (topbar y sidebar no se conocen entre sí) | [Paradigma]: Reactivo

import { MOBILE_NAV_ID } from "@aula/shared-nav/navigation"; // id del drawer → `aria-controls` del botón (WAI-ARIA) | SSOT compartido con Angular
export { MOBILE_NAV_ID };

interface MobileNavValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean; // [Escritorio]: sidebar oculto (≥ lg) → el contenido usa todo el ancho
  toggleCollapsed: () => void;
}


// `createContext` (React): valor por defecto inerte → sin Provider no rompe (p. ej. en tests)
const MobileNavContext = createContext<MobileNavValue>({ open: false, setOpen: () => {}, collapsed: false, toggleCollapsed: () => {} });

export function MobileNavProvider({ children, initialCollapsed = false }: { children: React.ReactNode; initialCollapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // [toggleCollapsed]: alterna y recuerda la preferencia un año | `document.cookie` (DOM): legible por el servidor en la próxima visita
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };
  const pathname = usePathname();
  // [Cerrar al navegar]: patrón "ajustar estado al cambiar una prop" de React (sin efecto) → cambia la ruta ⇒ se cierra el drawer
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // [Drawer abierto]: Escape cierra (WCAG 2.1.2) + bloqueo del scroll del fondo | listeners con cleanup
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return <MobileNavContext.Provider value={{ open, setOpen, collapsed, toggleCollapsed }}>{children}</MobileNavContext.Provider>;
}

// [useMobileNav]: acceso tipado al contexto | [Patrón]: Custom Hook
export const useMobileNav = () => useContext(MobileNavContext);

// [MobileNavButton]: hamburguesa dentro del topbar (solo < lg) | `aria-expanded` + `aria-controls` anuncian el estado del menú
export function MobileNavButton() {
  const { open, setOpen } = useMobileNav();
  const { t } = usePreferences();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
      aria-expanded={open}
      aria-controls={MOBILE_NAV_ID}
      className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
    >
      {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
    </button>
  );
}

// [SidebarToggleButton]: contrae el sidebar a riel de iconos o lo expande en escritorio (≥ lg) · vive en la cabecera del propio sidebar (Claude web / Gemini) | `aria-expanded` + `aria-controls` (WAI-ARIA) anuncian el estado
// [Estilo]: botón fantasma (sin borde) → no compite con el logo; hover con superficie suave
export function SidebarToggleButton() {
  const { collapsed, toggleCollapsed } = useMobileNav();
  const { t } = usePreferences();
  const label = collapsed ? t.nav.showSidebar : t.nav.hideSidebar;
  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={label}
      title={label}
      aria-expanded={!collapsed}
      aria-controls={MOBILE_NAV_ID}
      className="hidden size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid"
    >
      {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
    </button>
  );
}

// [PortalFrame]: rejilla del portal; contraído, la columna pasa de 260px al riel de 72px | [Patrón]: Layout Component | `transition-[grid-template-columns]` respeta «reducir movimiento»
export function PortalFrame({ children }: { children: React.ReactNode }) {
  const { collapsed } = useMobileNav();
  return (
    <div className={cn("min-h-screen bg-background lg:grid motion-safe:transition-[grid-template-columns]", collapsed ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[260px_1fr]")}>
      {children}
    </div>
  );
}
