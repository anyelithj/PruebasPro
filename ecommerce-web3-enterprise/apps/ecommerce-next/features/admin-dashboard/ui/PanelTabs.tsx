// PanelTabs.tsx (Client Component) => barra de pestañas ÚNICA del panel, dibujada desde el manifiesto: los ítems de la sección
// activa. Espejo exacto de PanelTabs.vue (Nuxt): mismas clases (.panel-tab en globals.css y tailwind.css) y misma regla.
// Sin scroll horizontal: hasta MAX_VISIBLE pestañas (la activa siempre entre ellas) y el resto en el Dropdown «Más» (Radix).
// Son enlaces reales (una pestaña puede vivir en la otra app), por eso <nav> + aria-current y no role="tab".
// Patrones: Strategy (visibles vs. desbordadas), Progressive Disclosure (Dropdown).
"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"; // Radix: menú accesible (flechas, Escape, foco)
import type { AdminNavItem } from "@ecommerce/shared-types";
import { Link } from "@/shared/lib/i18n/navigation";
import { NavIcon, nuxtHref, usePanelNav } from "./AdminSidebar";

const MAX_VISIBLE = 5; // Mismo valor en PanelTabs.vue

export function PanelTabs() {
  const { active, locale, text } = usePanelNav();
  const items = active?.group.items ?? [];
  if (items.length <= 1) return null; // Sección de una sola función => sin barra

  const head = items.slice(0, MAX_VISIBLE);
  const current = active?.item;
  const visible = !current || head.includes(current) ? head : [...head.slice(0, MAX_VISIBLE - 1), current];
  const overflow = items.filter((item) => !visible.includes(item));

  const tabLink = (item: AdminNavItem, className: string) => {
    const props = { className, "aria-current": item === current ? ("page" as const) : undefined };
    return item.app === "next" ? <Link href={item.path} {...props}>{item.label[locale]}</Link> : <a href={nuxtHref(item, locale)} {...props}>{item.label[locale]}</a>;
  };

  return (
    <nav aria-label={active?.group.label[locale]} className="panel-tabs">
      {visible.map((item) => <span key={item.key} className="contents">{tabLink(item, "panel-tab")}</span>)}
      {overflow.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="panel-tab">
            {text("more")}
            <NavIcon name="chevron" className="size-3.5" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="panel-tabs-menu z-50">
              {overflow.map((item) => (
                <DropdownMenu.Item key={item.key} asChild>{tabLink(item, "panel-tab w-full")}</DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </nav>
  );
}
