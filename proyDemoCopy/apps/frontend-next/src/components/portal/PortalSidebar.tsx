"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Globe,
  LayoutGrid,
  FileText,
  MessageSquare,
  TrendingUp,
  Users,
  BarChart3,
  GraduationCap,
  Library,
  UserRound,
  NotebookText,
  Sparkles,
  PenLine,
  ClipboardList,
  CircleHelp,
  Award,
  Gamepad2,
  Puzzle,
  Languages,
  MessagesSquare,
  Music,
  ChevronDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { BRAND } from "@/config/brand";
import { usePreferences } from "@/components/layout/PreferencesProvider";
// [Menú compartido con Angular]: ítems por rol, activo, avatar | config/navigation.ts es la SSOT de los dos frontends | [Principio]: DRY
import { activeHrefFor, initialsFromName, isNavGroup, NAV_BY_ROLE, navEntries, ROLE_GRADIENT, type NavIcon, type NavItem, type PortalRole } from "@aula/shared-nav/navigation";
import { MOBILE_NAV_ID, SidebarToggleButton, useMobileNav } from "./MobileNav"; // [Menú]: drawer móvil (topbar) + ocultar/mostrar en escritorio (cabecera del sidebar)

export type { PortalRole }; // `export type { … }` (TS): re-exporta el tipo para no romper imports existentes

// [ICONS]: nombre lucide del config → componente lucide-react | `Record<NavIcon, …>` (TS) obliga a cubrir todos los iconos | [Patrón]: Lookup Table
const ICONS: Record<NavIcon, LucideIcon> = {
  "layout-grid": LayoutGrid,
  "file-text": FileText,
  "message-square": MessageSquare,
  "trending-up": TrendingUp,
  users: Users,
  "chart-column": BarChart3,
  "graduation-cap": GraduationCap,
  library: Library,
  "user-round": UserRound,
  "notebook-text": NotebookText,
  sparkles: Sparkles,
  "pen-line": PenLine,
  "clipboard-list": ClipboardList,
  "circle-help": CircleHelp, // [Sprint 7.11]: Ayuda
  award: Award, // [Sprint 7.8]: Certificados
  "gamepad-2": Gamepad2, // [Sprint 8.8]: Juegos
  puzzle: Puzzle, // [Sprint 8.14]: Práctica interactiva
  languages: Languages, // [Sprint 8.3]: Vocabulario y traductor
  music: Music, // [Sprint 9.8]: Música
  "messages-square": MessagesSquare, // [Sprint 9.11]: Diálogos
  globe: Globe, // [Sprint 10.7]: Poliglota
  "book-open": BookOpen, // [Sprint 10.11]: Gramática
};

// [Placeholder sin sesión]: nombre genérico por rol (solo si el JWT no trae email)
const FALLBACK_NAME: Record<PortalRole, string> = { estudiante: "Estudiante", docente: "Docente", admin: "Admin" };

function deriveRole(pathname: string): PortalRole {
  if (pathname.startsWith("/dashboard/docente")) return "docente";
  if (pathname.startsWith("/dashboard/admin")) return "admin";
  return "estudiante";
}

export function PortalSidebar({
  role: roleProp,
  displayName,
}: { role?: PortalRole; displayName?: string } = {}) {
  const pathname = usePathname();
  const { t } = usePreferences(); // [i18n]: diccionario del idioma activo
  const role = roleProp ?? deriveRole(pathname);
  const { open, setOpen, collapsed } = useMobileNav(); // [Context]: hamburguesa (móvil) en el topbar · ocultar (escritorio) en la cabecera del sidebar, como Claude web / Gemini
  const nav = NAV_BY_ROLE[role];
  const activeHref = activeHrefFor(pathname, nav); // [Derivado]: se calcula en render, sin estado extra | [Principio]: KISS
  // [Grupo «Actividades» · 2026-10-19]: abierto si una de sus secciones está activa; el usuario puede plegarlo/desplegarlo
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // [Usuario visible]: nombre del JWT o placeholder por rol | helpers compartidos con el topbar (portal-role.ts) | [Principio]: DRY
  const name = displayName ?? FALLBACK_NAME[role];
  const user = { name, initials: initialsFromName(name), gradient: ROLE_GRADIENT[role] };

  // [renderItem]: enlace del menú (también dentro de un grupo) | `item.hard ? "a" : Link`: mismas props → un solo JSX para ambos casos
  const renderItem = (item: NavItem) => {
    const active = item.href === activeHref;
    const NavLink = item.hard ? "a" : Link;
    const Icon = ICONS[item.icon];
    return (
      <NavLink
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined} // [A11y]: lector de pantalla anuncia la sección actual
        onClick={() => setOpen(false)}
        title={collapsed ? t.nav[item.labelKey] : undefined} // [Riel]: tooltip nativo con el nombre (el texto sigue en el DOM como sr-only para lectores de pantalla)
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          collapsed && "lg:justify-center lg:px-0",
          active ? "bg-gradient-soft text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={2} />
        <span className={cn(collapsed && "lg:sr-only")}>{t.nav[item.labelKey]}</span>
      </NavLink>
    );
  };

  return (
    <>
      {/* [Overlay]: oscurece el fondo con el drawer abierto; clic fuera = cerrar (solo < lg) */}
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" aria-hidden="true" />}

      <aside
        id={MOBILE_NAV_ID}
        className={cn(
          "fixed top-0 left-0 z-50 lg:sticky lg:z-auto",
          "h-dvh w-[260px] max-w-[85vw] overflow-y-auto overflow-x-hidden", // `h-dvh` (CSS dvh): alto real en móviles con barra del navegador
          "flex flex-col gap-1 border-r border-border bg-card p-5",
          // [Riel de iconos (escritorio)]: oculto ≠ desaparecer → columna estrecha de 72px con solo iconos (patrón de Claude web / Gemini); el drawer móvil no cambia (solo clases `lg:`)
          collapsed && "lg:w-[72px] lg:px-3",
          "transition-[transform,visibility] duration-300 motion-reduce:transition-none", // Respeta "reducir movimiento" (a11y)
          // [Cerrado en móvil]: fuera de pantalla + `invisible` → sus enlaces no reciben foco con Tab | desde lg siempre visible
          open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible lg:translate-x-0",
        )}
      >
        {/* [Cerrar drawer]: el botón del topbar queda bajo el overlay → cierre dentro del propio panel (solo < lg) */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t.nav.closeMenu}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <X className="size-5" aria-hidden />
        </button>
        {/* [Cabecera]: logo + botón ocultar a la derecha (como Claude web / Gemini) · en riel solo queda el botón, centrado, para volver a expandir */}
        <div className={cn("mb-3 flex items-center justify-between gap-2 border-b border-border pb-5", collapsed && "lg:justify-center")}>
        <Link
          href="/"
          className={cn("flex min-w-0 items-center gap-2.5 font-bold text-lg", collapsed && "lg:hidden")}
        >
          <span className="grid place-items-center size-9 rounded-xl bg-gradient-brand text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3 3 3 0 0 0-3-3z" />
            </svg>
          </span>
          <span className="truncate">{BRAND.name}</span>
        </Link>
        <SidebarToggleButton />
        </div>

        <nav className="flex flex-col gap-1" aria-label={t.nav.mainNav}>
          <div className={cn("text-[11px] uppercase tracking-wider text-muted-foreground/80 px-3 pt-3 pb-1.5", collapsed && "lg:sr-only")}>
            {t.roles[role]}
          </div>
          {navEntries(nav).map((entry) => {
            if (!isNavGroup(entry)) return renderItem(entry);
            // [Desplegable]: botón con aria-expanded + lista de subsecciones (WAI-ARIA Disclosure) | en el riel contraído se ven los iconos sin título de grupo
            const hasActive = entry.items.some((i) => i.href === activeHref);
            const expanded = openGroups[entry.group] ?? hasActive;
            const GroupIcon = ICONS[entry.icon];
            const listId = `nav-group-${entry.group}`;
            return (
              <div key={entry.group} className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  onClick={() => setOpenGroups((g) => ({ ...g, [entry.group]: !expanded }))}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    collapsed && "lg:hidden",
                    hasActive ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <GroupIcon className="size-[18px] shrink-0" strokeWidth={2} />
                  <span className="flex-1 text-left">{t.nav[entry.labelKey]}</span>
                  <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
                </button>
                <div id={listId} className={cn("flex flex-col gap-1 border-l border-border pl-2 ml-5", !expanded && "hidden", collapsed && "lg:ml-0 lg:flex lg:border-l-0 lg:pl-0")}>
                  {entry.items.map(renderItem)}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={cn("mt-auto pt-4 border-t border-border flex items-center gap-3", collapsed && "lg:justify-center")}>
          <div
            title={collapsed ? user.name : undefined}
            className="grid place-items-center size-10 shrink-0 rounded-full text-white font-bold text-sm"
            style={{ background: user.gradient }}
          >
            {user.initials}
          </div>
          {/* [Riel]: solo el avatar; cerrar sesión sigue en el menú de perfil del topbar */}
          <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
            <b className="block text-sm truncate">{user.name}</b>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
