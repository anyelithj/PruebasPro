// AdminSection.tsx => piezas comunes de las páginas del panel admin (DRY, mismo enfoque que AccountSection):
// metadatos traducidos por sección y la fábrica "adminPage" que arma cada página (Server Component) con su <h1> único
// (PanelHeading: jerarquía de títulos accesible) y su sección de cliente.
// Patrones: Factory Function (adminMetadata, adminPage) + Template Method (todas las páginas tienen la misma forma).
import type { Metadata } from "next";
import type { ComponentType } from "react";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/shared/lib/i18n/server";
import type { PageProps } from "@/shared/types/next.types";
import type { AdminNav } from "@ecommerce/shared-types";
import navData from "@ecommerce/shared-types/admin-nav.json";
import { PanelHeading } from "@/features/admin-dashboard/ui/PanelHeading";

// rfOf => código RF de la pantalla según el manifiesto compartido (mismo dato que muestra Nuxt)
const rfOf = (key: string) => (navData as AdminNav).groups.flatMap((group) => group.items).find((item) => item.key === key)?.rf;

// adminMetadata => fábrica de generateMetadata (Factory Function + clausura sobre "key")
export function adminMetadata(key: string) {
  return async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const t = await getTranslations({ locale: (await params).locale, namespace: "admin.nav" });
    return { title: t(key) };
  };
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
        <PanelHeading title={t(`nav.${key}`)} description={t(`descriptions.${key}`)} rf={rfOf(key === "productNew" ? "products" : key)} />
        <Section />
      </>
    );
  };
}
