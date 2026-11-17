// PanelHeading.tsx (Client Component) => <h1> de una página del panel. Una misma ruta sirve varios ítems del menú
// (/dashboard/orders: Pedidos, Facturación, Envíos...) y solo el navegador sabe cuál está activo, así que el título sale
// del ítem activo del manifiesto; en las demás páginas (Nuevo producto, Editar...) se usa lo que manda el servidor.
"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/shared/lib/i18n/navigation";
import { usePanelNav } from "./AdminSidebar";

interface PanelHeadingProps {
  title: ReactNode;
  description?: string | undefined;
  rf?: string | undefined;
}

export function PanelHeading({ title, description, rf }: PanelHeadingProps) {
  const { active, locale } = usePanelNav();
  const pathname = usePathname();
  // Solo cuando la URL es exactamente la del ítem: /dashboard/products/new sigue siendo "Nuevo producto"
  const item = active?.item.path.split("?")[0] === pathname ? active.item : null;
  const code = item?.rf ?? rf;
  // Una pestaña trae su propia ayuda (AdminTabs): el texto general de la sección no aplica a ella
  const subtitle = item?.path.includes("?") ? item.description?.[locale] : (item?.description?.[locale] ?? description);
  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        {item?.label[locale] ?? title}
        {code && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-secondary-foreground">{code}</span>}
      </h1>
      {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}
