// AdminSidebar.tsx (Client Component · React + Tailwind) => menú lateral ÚNICO de la plataforma (panel admin, "Mi cuenta"
// y chatbot), dibujado desde el manifiesto COMPARTIDO con Nuxt (@ecommerce/shared-types/admin-nav.json). Nuxt tiene el
// espejo exacto (AdminSidebar.vue): mismo diseño, orden, textos e íconos => el usuario no distingue qué app sirve la pantalla.
// Diseño "pro sidebar": fondo oscuro, marca, tarjeta del usuario (avatar, rol, en línea), buscador de opciones, grupos
// plegables (acordeón), ítem activo resaltado, riel de solo íconos (escritorio) y panel deslizable con fondo (móvil).
// Patrones: Composite (grupos -> ítems como datos), Adapter (itemHref traduce un ítem a URL de Next o de Nuxt),
// Strategy (navVisible decide qué ve cada rol), Shared Kernel (manifiesto compartido). Paradigma declarativo + funcional.
// Accesibilidad: <nav> con nombre, acordeón WAI-ARIA (aria-expanded/aria-controls), aria-current="page", foco visible,
// tooltips (title) en el riel, Escape cierra el panel móvil; todos los ítems son <a> reales (cursor de mano y teclado).
"use client"; // Directiva de Next.js: usa hooks (ruta activa, sesión, estado) => se ejecuta en el navegador

import { useEffect, useMemo, useState } from "react"; // Hooks de React: efectos, valores memorizados y estado local
import { useLocale } from "next-intl"; // next-intl: idioma activo ("es" | "en")
import type { AdminLocale, AdminNav, AdminNavGroup, AdminNavItem, AdminNavText } from "@ecommerce/shared-types"; // "import type" => 0 bytes
import navData from "@ecommerce/shared-types/admin-nav.json"; // Manifiesto JSON (lo resuelve el bundler, sin fetch)
import { Link, usePathname } from "@/shared/lib/i18n/navigation"; // Link con prefijo de idioma (next-intl)
import { useAuth } from "@/shared/hook/useAuth"; // Facade sobre la sesión de next-auth
import { config } from "@/shared/constants/config";
import { panelHome } from "@/shared/constants/routes"; // Inicio del panel por rol (fuente única, DRY)
import { cn } from "@/shared/lib/cn";
import { LinkPending } from "@/shared/ui/Spinner"; // Spinner dentro del enlace mientras Next navega

// "as AdminNav" => aserción: el JSON queda tipado con el contrato del paquete compartido
export const NAV = navData as AdminNav;

// NavIcon => SVG del manifiesto. "dangerouslySetInnerHTML" es seguro: marcado estático versionado en el repo (nunca del
// usuario ni de la API). aria-hidden porque el texto del enlace ya nombra la opción.
export function NavIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cn("shrink-0", className)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: NAV.icons[name] ?? "" }} />;
}

// navVisible => regla de visibilidad por rol (la misma en AdminSidebar.vue): "account" para toda sesión; ADMIN todo;
// VENDOR además todo ítem (de Next o de Nuxt) que no sea solo-ADMIN ("adminOnly" en el manifiesto) — Strategy por rol
export const navVisible = (group: AdminNavGroup, item: AdminNavItem, roles: readonly string[]) =>
  group.key === "account" || roles.includes("ADMIN") || (roles.includes("VENDOR") && !item.adminOnly);

// matchLength => cuánto de la URL coincide con el ítem (0 = nada); el ítem activo es el de mayor coincidencia
const matchLength = (item: AdminNavItem, path: string) =>
  Math.max(0, ...[item.path, ...(item.match ?? [])].map((prefix) => (path === prefix || path.startsWith(`${prefix}/`) || (prefix.endsWith("-") && path.startsWith(prefix)) ? prefix.length : 0)));

// usePanelNav => Hook compartido por el menú y la barra superior (DRY): idioma, textos, grupos visibles e ítem activo
export function usePanelNav() {
  const locale: AdminLocale = useLocale() === "en" ? "en" : "es";
  const pathname = usePathname(); // Ruta SIN prefijo de idioma
  const { user } = useAuth();
  const roles = useMemo(() => user?.roles ?? [], [user]);
  // "useMemo" => solo se recalcula si cambian los roles (la lista del menú es estable entre renders)
  const groups = useMemo(() => NAV.groups.map((group) => ({ ...group, items: group.items.filter((item) => navVisible(group, item, roles)) })).filter((group) => group.items.length > 0), [roles]);
  // Ítem activo: solo los de Next (los de Nuxt viven en otra app); gana la coincidencia más larga
  const active = useMemo(() => {
    let best: { group: AdminNavGroup; item: AdminNavItem; score: number } | null = null;
    for (const group of groups) for (const item of group.items) {
      const score = item.app === "next" ? matchLength(item, pathname) : 0;
      if (score > (best?.score ?? 0)) best = { group, item, score };
    }
    return best;
  }, [groups, pathname]);
  const text = (key: AdminNavText) => NAV.text[key][locale];
  return { locale, groups, active, text, user };
}

// itemHref => URL de un ítem servido por Nuxt (español sin prefijo, otros idiomas /<locale>, igual que Next)
const nuxtHref = (item: AdminNavItem, locale: string) => `${config.cmsUrl}${locale === "es" ? "" : `/${locale}`}${item.path}`;
// storeHref => tienda (Nuxt) en el idioma actual: la usan el pie del menú y la barra superior
export const storeHref = (locale: string) => (locale === "es" ? config.cmsUrl : `${config.cmsUrl}/${locale}`);

// initials => "Ana María Pérez" -> "AP" (primera y última palabra) — función pura
export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
};

// Clases compartidas (DRY) — idénticas en AdminSidebar.vue. Menú compacto: fila de 28 px (ícono 24 px + 2 px arriba/abajo),
// sobre el mínimo de 24 px de WCAG 2.5.8 (tamaño del objetivo táctil)
const ITEM = "group/item relative flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-0.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";
const ITEM_ACTIVE = "bg-indigo-500/15 text-white";
const ICON_BOX = "flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-400 transition-colors group-hover/item:text-indigo-300";
const ICON_BOX_ACTIVE = "bg-indigo-500 text-white group-hover/item:text-white";

interface Props {
  collapsed: boolean; // Riel de solo íconos (escritorio)
  mobileOpen: boolean; // Panel deslizable abierto (móvil)
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

export function AdminSidebar({ collapsed, mobileOpen, onToggleCollapsed, onCloseMobile }: Props) {
  const { locale, groups, active, text, user } = usePanelNav();
  const [query, setQuery] = useState(""); // Filtro del buscador del menú
  const pathname = usePathname();

  // Acordeón: el grupo de la ruta activa se abre solo; el usuario puede abrir/cerrar los demás
  const [open, setOpen] = useState<Set<string>>(() => new Set(active ? [active.group.key] : ["account"]));
  useEffect(() => {
    if (active) setOpen((prev) => (prev.has(active.group.key) ? prev : new Set(prev).add(active.group.key)));
  }, [active]);
  useEffect(() => onCloseMobile(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- al navegar se cierra el panel móvil
  const toggleGroup = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key); // "delete" devuelve false si no estaba => se abre
      return next;
    });

  // Buscador: filtra por texto sin tildes ("normalize NFD" + quitar diacríticos) y abre todos los grupos con resultados
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return groups;
    return groups.map((group) => ({ ...group, items: group.items.filter((item) => normalize(item.label[locale]).includes(q)) })).filter((group) => group.items.length > 0);
  }, [groups, query, locale]);
  const searching = query.trim().length > 0;
  const roleLabel = user?.roles.map((role) => NAV.roles[role]?.[locale] ?? role)[0] ?? "";

  const renderItem = (item: AdminNavItem) => {
    const isActive = active?.item.key === item.key;
    const label = item.label[locale];
    const className = cn(ITEM, collapsed && "lg:justify-center lg:px-0", isActive && ITEM_ACTIVE);
    const content = (
      <>
        {/* Barra de acento a la izquierda del ítem activo */}
        {isActive && <span className="absolute inset-y-1 -left-3 w-1 rounded-r-full bg-indigo-400" aria-hidden="true" />}
        <span className={cn(ICON_BOX, isActive && ICON_BOX_ACTIVE)}>
          <NavIcon name={item.icon} />
        </span>
        <span className={cn("truncate", collapsed && "lg:sr-only")}>{label}</span>
      </>
    );
    return item.app === "next" ? (
      // Ruta de Next => navegación SPA con prefetch; LinkPending muestra el spinner mientras carga
      <Link href={item.path} title={collapsed ? label : undefined} aria-current={isActive ? "page" : undefined} className={className}>
        {content}
        <LinkPending className={cn("text-indigo-300", collapsed && "lg:hidden")} />
      </Link>
    ) : (
      // Ruta de Nuxt => <a> normal con href (otra aplicación, misma sesión por SSO)
      <a href={nuxtHref(item, locale)} title={collapsed ? label : undefined} className={className}>
        {content}
      </a>
    );
  };

  return (
    <>
      {/* Fondo del panel móvil: clic fuera cierra (el botón de cerrar es la alternativa accesible) */}
      <div className={cn("fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity lg:hidden", mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onCloseMobile} aria-hidden="true" />
      <aside
        id="panel-sidebar"
        onKeyDown={(event) => event.key === "Escape" && onCloseMobile()}
        className={cn(
          // "scale-fixed" => el menú es oscuro en los dos temas (no se invierte la escala slate en modo oscuro)
          "scale-fixed fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-300 shadow-xl transition-[width,transform] duration-200 ease-out motion-reduce:transition-none lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-72"
        )}
      >
        {/* Marca: vuelve al inicio del panel según el rol (panelHome) */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <Link href={panelHome(user?.roles ?? [])} className={cn("flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400", collapsed && "lg:mx-auto")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow">W3</span>
            <span className={cn("truncate font-semibold text-white", collapsed && "lg:sr-only")}>{config.siteName}</span>
          </Link>
          <button type="button" onClick={onCloseMobile} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label={text("closeMenu")}>
            <NavIcon name="close" className="size-5" />
          </button>
        </div>

        {/* Tarjeta del usuario (como el ejemplo "pro sidebar"): avatar con iniciales, nombre, rol y estado */}
        {user && (
          <div className={cn("flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4", collapsed && "lg:justify-center lg:px-0")}>
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-200" title={collapsed ? user.name : undefined}>
              {initials(user.name)}
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" aria-hidden="true" />
            </span>
            <div className={cn("min-w-0", collapsed && "lg:sr-only")}>
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-400">
                {roleLabel} · <span className="text-emerald-400">{text("online")}</span>
              </p>
            </div>
          </div>
        )}

        {/* Buscador del menú (role="search"); oculto en el riel de íconos */}
        <div role="search" className={cn("shrink-0 px-3 pt-3", collapsed && "lg:hidden")}>
          <label className="relative block">
            <span className="sr-only">{text("search")}</span>
            <NavIcon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("search")} className="h-9 w-full rounded-md border border-transparent bg-slate-800 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none" />
          </label>
        </div>

        <nav aria-label={text("menu")} className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-color:theme(colors.slate.700)_transparent] [scrollbar-width:thin]">
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">{text("noResults")}</p>}
          {filtered.map((group) => {
            const expanded = collapsed || searching || open.has(group.key);
            const panelId = `nav-panel-${group.key}`;
            return (
              <section key={group.key} aria-label={group.label[locale]} className={cn("mb-0.5", collapsed && "lg:mb-2 lg:border-t lg:border-white/10 lg:pt-3 lg:first:border-t-0 lg:first:pt-0")}>
                {/* Cabecera de acordeón (WAI-ARIA): botón con aria-expanded que controla su panel */}
                <h2 className={cn(collapsed && "lg:sr-only")}>
                  <button type="button" onClick={() => toggleGroup(group.key)} aria-expanded={expanded} aria-controls={panelId} className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                    {group.label[locale]}
                    <NavIcon name="chevron" className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
                  </button>
                </h2>
                {/* Cerrado => clase "hidden" (display:none). El atributo hidden solo NO basta: la clase "flex" de Tailwind
                    tiene más especificidad que el [hidden] del preflight y el grupo nunca se ocultaba */}
                <ul id={panelId} hidden={!expanded} className={cn("flex flex-col gap-px", !expanded && "hidden")}>
                  {group.items.map((item) => (
                    <li key={item.key}>{renderItem(item)}</li>
                  ))}
                </ul>
              </section>
            );
          })}
        </nav>

        {/* Pie: volver a la tienda + ocultar/mostrar el menú (solo escritorio) */}
        <div className={cn("flex shrink-0 items-center gap-1 border-t border-white/10 p-3", collapsed && "lg:flex-col")}>
          <a href={storeHref(locale)} title={text("store")} className={cn(ITEM, "flex-1", collapsed && "lg:w-full lg:justify-center lg:px-0")}>
            <span className={ICON_BOX}>
              <NavIcon name="store" />
            </span>
            <span className={cn("truncate", collapsed && "lg:sr-only")}>{text("store")}</span>
          </a>
          <button type="button" onClick={onToggleCollapsed} aria-pressed={collapsed} aria-controls="panel-sidebar" title={collapsed ? text("expand") : text("collapse")} className="hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 lg:flex">
            <span className="sr-only">{collapsed ? text("expand") : text("collapse")}</span>
            <NavIcon name="collapse" className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>
      </aside>
    </>
  );
}
