// AdminTabs.tsx (Client Component) => contenido de la pestaña activa de una sección del panel (pedidos/envíos/facturas...).
// La barra de pestañas es ÚNICA y vive en el marco (PanelTabs, desde el manifiesto); aquí solo se decide qué mostrar según
// "?tab=<id>" en la URL. La pestaña activa también vive en Redux (Client State): se conserva al volver a la sección.
// Rendimiento: solo se monta el panel activo (las demás pestañas no consultan la API hasta abrirse).
// Patrón: Observer (Redux).
"use client"; // Directiva de Next.js: hooks y eventos => se ejecuta en el navegador

import { useEffect, type ReactNode } from "react"; // Hooks de React
import { useSearchParams } from "next/navigation"; // Hook de Next.js: lee la query (?tab=) de la URL actual
import { useAdminDashboard } from "../model/dashboard.store";

export interface TabItem {
  id: string;
  label: string;
  render: () => ReactNode; // Función (no nodo): el contenido se crea solo para la pestaña activa (lazy)
  description?: string; // Ayuda en lenguaje de negocio: PARA QUÉ sirve la pestaña (sin jerga técnica)
}

export function AdminTabs({ section, tabs, label }: { section: string; tabs: TabItem[]; label: string }) {
  const { tabs: active, setTab } = useAdminDashboard();
  const queryTab = useSearchParams().get("tab");
  // La URL manda: al llegar por un enlace no se monta (ni consulta la API) la pestaña anterior
  const current = tabs.find((tab) => tab.id === queryTab) ?? tabs.find((tab) => tab.id === active[section]) ?? tabs[0];

  // URL -> estado: Redux marca la pestaña y la sección activas en el menú
  useEffect(() => {
    if (queryTab && queryTab !== active[section] && tabs.some((tab) => tab.id === queryTab)) setTab({ section, tab: queryTab });
  }, [queryTab]); // eslint-disable-line react-hooks/exhaustive-deps -- solo reacciona a cambios de la URL

  return (
    <section aria-label={label}>
      {current?.description && <p className="mb-4 max-w-3xl text-sm text-slate-600">{current.description}</p>}
      {current?.render()}
    </section>
  );
}
