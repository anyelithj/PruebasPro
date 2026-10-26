// AdminSection.tsx => piezas comunes de las páginas del panel admin (DRY, mismo enfoque que AccountSection):
// metadatos traducidos por sección, encabezado <h1> único por página (jerarquía de títulos accesible) y la fábrica
// "adminPage" que arma cada página (Server Component) con su sección de cliente.
// Patrones: Factory Function (adminMetadata, adminPage) + Template Method (todas las páginas tienen la misma forma).
import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/shared/lib/i18n/server";
import type { PageProps } from "@/shared/types/next.types";
import type { AdminNav } from "@ecommerce/shared-types";
import navData from "@ecommerce/shared-types/admin-nav.json";

// rfOf => código RF de la pantalla según el manifiesto compartido (mismo dato que muestra Nuxt)
const rfOf = (key: string) => (navData as AdminNav).groups.flatMap((group) => group.items).find((item) => item.key === key)?.rf;

// adminMetadata => fábrica de generateMetadata (Factory Function + clausura sobre "key")
export function adminMetadata(key: string) {
  return async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const t = await getTranslations({ locale: (await params).locale, namespace: "admin.nav" });
    return { title: t(key) };
  };
}

// AdminHeading => título de la página + descripción opcional
export function AdminHeading({ children, description, rf }: { children: ReactNode; description?: string; rf?: string | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
        {children}
        {rf && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{rf}</span>}
      </h1>
      {description && <p className="text-sm text-slate-600">{description}</p>}
    </div>
  );
}

// adminPage => Server Component de una sección: fija el idioma (render estático por locale), pinta el <h1> traducido
// y monta la sección interactiva (Client Component). "ComponentType" => cualquier componente sin props.
// El RBAC ya lo resolvieron proxy.ts y el layout del grupo (admin): aquí no se repite (DRY).
export function adminPage(key: string, Section: ComponentType) {
  return async function AdminPage({ params }: PageProps) {
    await initPage(params);
    const t = await getTranslations("admin");
    return (
      <>
        <AdminHeading description={t(`descriptions.${key}`)} rf={rfOf(key === "productNew" ? "products" : key)}>{t(`nav.${key}`)}</AdminHeading>
        <Section />
      </>
    );
  };
}
