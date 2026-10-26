// AdminTabs.tsx (Client Component) => pestañas accesibles de las secciones del panel (pedidos/envíos/facturas...).
// Patrón WAI-ARIA Tabs: role="tablist"/"tab"/"tabpanel", flechas izquierda/derecha para moverse (roving tabindex).
// La pestaña activa vive en Redux (Client State) => se conserva al navegar entre secciones del panel.
// Rendimiento: solo se monta el panel activo (las demás pestañas no consultan la API hasta abrirse).
// Sin scroll horizontal: se muestran como máximo MAX_VISIBLE pestañas; el resto entra en un Dropdown "Más" (Radix).
// Deep link: "?tab=<id>" en la URL abre esa pestaña (lo usan los ítems del menú lateral, p. ej. CRM › Segmentos) y al
// cambiar de pestaña la URL se actualiza con history.replaceState (Next 16+ lo sincroniza con useSearchParams).
// Patrones: Observer (Redux), Strategy (visibles vs. desbordadas), Progressive Disclosure (Dropdown "Más").
"use client"; // Directiva de Next.js: hooks y eventos => se ejecuta en el navegador

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react"; // Hooks de React
import { useSearchParams } from "next/navigation"; // Hook de Next.js: lee la query (?tab=) de la URL actual
import { useLocale } from "next-intl"; // next-intl: idioma activo para el texto "Más"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"; // Radix: menú accesible (flechas, Escape, foco)
import type { AdminNav } from "@ecommerce/shared-types"; // "import type" => solo tipos, 0 bytes en el bundle
import navData from "@ecommerce/shared-types/admin-nav.json"; // Textos compartidos con Nuxt ("more")
import { useAdminDashboard } from "../model/dashboard.store";
import { cn } from "@/shared/lib/cn";

const MAX_VISIBLE = 5; // Pestañas visibles antes de agrupar el resto en "Más" (cabe en 1 línea desde 768 px)
const NAV_TEXT = (navData as AdminNav).text; // "as" => aserción de tipo: el JSON cumple el contrato compartido

export interface TabItem {
  id: string;
  label: string;
  render: () => ReactNode; // Función (no nodo): el contenido se crea solo para la pestaña activa (lazy)
  description?: string; // Ayuda en lenguaje de negocio: PARA QUÉ sirve la pestaña (sin jerga técnica)
}

// TAB_RF => requisito funcional (RF) del documento de especificación que cubre cada pestaña ("sección:pestaña"),
// visible junto al nombre para ubicar el reporte RF desde la interfaz. Tabla única: una fila por pestaña.
const TAB_RF: Record<string, string> = {
  "ai-assistant:support": "RF-17.11", "ai-assistant:nlu": "RF-17.12", "ai-assistant:contact": "RF-21.2", "ai-assistant:knowledge": "RF-17.8",
  "ai-assistant:tools": "RF-17.3", "ai-assistant:actions": "RF-17.3", "ai-assistant:evaluations": "RF-17.4",
  "analytics:overview": "RF-24.1", "analytics:heatmap": "RF-24.8", "analytics:attribution": "RF-24.11", "analytics:cohorts": "RF-24.2",
  "analytics:crypto": "RF-24.12", "analytics:alerts": "RF-24.10", "analytics:simulation": "RF-24.14",
  "customers:list": "RF-22.1", "customers:segments": "RF-22.2", "customers:cohorts": "RF-22.7", "customers:value": "RF-22.3", "customers:duplicates": "RF-22.4",
  "inventory:stock": "RF-23.1", "inventory:suppliers": "RF-23.5", "inventory:purchases": "RF-23.6", "inventory:ranking": "RF-23.5",
  "inventory:valuation": "RF-23.3", "inventory:audit": "RF-23.7",
  "marketing:campaigns": "RF-21.4", "marketing:emails": "RF-21.1", "marketing:templates": "RF-21.6", "marketing:coupons": "RF-13.1",
  "marketing:promotions": "RF-13.4", "marketing:multipliers": "RF-14.9",
  "orders:orders": "RF-09.2", "orders:shipments": "RF-10.1", "orders:invoices": "RF-11.1", "orders:refunds": "RF-12.3", "orders:transfers": "RF-08.3", "orders:dian": "RF-11.3",
  "products:products": "RF-04.1", "products:brands": "RF-05.1",
  "settings:roles": "RF-03.1", "settings:permissions": "RF-03.3", "settings:webhooks": "RF-20.10", "settings:automation": "RF-20.1",
  "settings:automation-health": "RF-20.7", "settings:automation-templates": "RF-20.5", "settings:audit": "RF-30.1", "settings:audit-insights": "RF-30.7",
};

// splitTabs => Strategy (función pura): primeras MAX_VISIBLE pestañas visibles y el resto al Dropdown "Más"; la activa
// siempre se ve (si estaba en el desborde, ocupa el último lugar visible)
function splitTabs(tabs: TabItem[], current: TabItem | undefined) {
  const head = tabs.slice(0, MAX_VISIBLE);
  const visible = !current || head.includes(current) ? head : [...head.slice(0, MAX_VISIBLE - 1), current];
  return { visible, overflow: tabs.filter((tab) => !visible.includes(tab)) };
}

export function AdminTabs({ section, tabs, label }: { section: string; tabs: TabItem[]; label: string }) {
  const { tabs: active, setTab } = useAdminDashboard();
  const locale = useLocale() === "en" ? "en" : "es";
  const queryTab = useSearchParams().get("tab"); // "?tab=segments" => pestaña pedida por el menú lateral o un enlace
  const current = tabs.find((tab) => tab.id === active[section]) ?? tabs[0];
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  // URL -> estado: si la query nombra una pestaña válida de esta sección, se activa (Redux también marca el menú)
  useEffect(() => {
    if (queryTab && queryTab !== active[section] && tabs.some((tab) => tab.id === queryTab)) setTab({ section, tab: queryTab });
  }, [queryTab]); // eslint-disable-line react-hooks/exhaustive-deps -- solo reacciona a cambios de la URL

  // select => estado + URL (replaceState: no agrega entradas al historial ni recarga la página)
  const select = (id: string) => {
    setTab({ section, tab: id });
    const url = new URL(window.location.href); // URL => API web estándar para editar la query sin concatenar strings
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  };

  const { visible, overflow } = splitTabs(tabs, current);

  // onKeyDown => flechas cambian de pestaña (entre las visibles) y mueven el foco (patrón de teclado WAI-ARIA)
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    const next = (index + delta + visible.length) % visible.length;
    const tab = visible[next];
    if (!tab) return;
    select(tab.id);
    refs.current[next]?.focus();
  };

  const rf = (id: string) => TAB_RF[`${section}:${id}`]; // Código RF de la pestaña (o undefined)
  const RF_BADGE = "ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500";

  return (
    <div className="flex flex-col gap-4">
      {/* Una sola línea: máximo MAX_VISIBLE pestañas + "Más" => sin scroll horizontal ni saltos de línea */}
      <div className="flex items-end gap-x-1 border-b">
        <div role="tablist" aria-label={label} className="flex min-w-0 gap-x-1">
          {visible.map((tab, index) => {
            const selected = tab.id === current?.id;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                id={`${baseId}-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1} // Roving tabindex: Tab entra a la pestaña activa; las flechas recorren
                onClick={() => select(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                {tab.label}
                {rf(tab.id) && <span className={RF_BADGE}>{rf(tab.id)}</span>}
              </button>
            );
          })}
        </div>
        {overflow.length > 0 && (
          // Dropdown "Más": las pestañas restantes como opciones de menú (Radix: portal, foco atrapado, Escape)
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="-mb-px flex shrink-0 items-center gap-1 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {NAV_TEXT.more[locale]}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-md border bg-background p-1 shadow-lg">
                {overflow.map((tab) => (
                  <DropdownMenu.Item key={tab.id} onSelect={() => select(tab.id)} className="flex cursor-pointer items-center justify-between gap-3 rounded px-3 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-accent">
                    {tab.label}
                    {rf(tab.id) && <span className={RF_BADGE}>{rf(tab.id)}</span>}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${current?.id ?? ""}`} tabIndex={0} className="focus-visible:outline-none">
        {current?.description && <p className="mb-4 max-w-3xl text-sm text-slate-600">{current.description}</p>}
        {current?.render()}
      </div>
    </div>
  );
}
