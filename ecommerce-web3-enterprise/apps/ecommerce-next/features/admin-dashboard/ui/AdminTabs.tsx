// AdminTabs.tsx (Client Component) => pestañas accesibles de las secciones del panel (pedidos/envíos/facturas...).
// Patrón WAI-ARIA Tabs: role="tablist"/"tab"/"tabpanel", flechas izquierda/derecha para moverse (roving tabindex).
// La pestaña activa vive en Redux (Client State) => se conserva al navegar entre secciones del panel.
// Rendimiento: solo se monta el panel activo (las demás pestañas no consultan la API hasta abrirse).
"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useAdminDashboard } from "../model/dashboard.store";
import { cn } from "@/shared/lib/cn";

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

export function AdminTabs({ section, tabs, label }: { section: string; tabs: TabItem[]; label: string }) {
  const { tabs: active, setTab } = useAdminDashboard();
  const current = tabs.find((tab) => tab.id === active[section]) ?? tabs[0];
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  // onKeyDown => flechas cambian de pestaña y mueven el foco (patrón de teclado WAI-ARIA)
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    const next = (index + delta + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    setTab({ section, tab: tab.id });
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* flex-wrap: las pestañas bajan de línea en vez de desplazarse (sin barra de scroll) */}
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-1 border-b">
        {tabs.map((tab, index) => {
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
              onClick={() => setTab({ section, tab: tab.id })}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
              {TAB_RF[`${section}:${tab.id}`] && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{TAB_RF[`${section}:${tab.id}`]}</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${current?.id ?? ""}`} tabIndex={0} className="focus-visible:outline-none">
        {current?.description && <p className="mb-4 max-w-3xl text-sm text-slate-600">{current.description}</p>}
        {current?.render()}
      </div>
    </div>
  );
}
