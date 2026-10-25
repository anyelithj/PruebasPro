// layout.tsx (admin) => chrome del panel de administración (Fase 7): marco único PanelFrame (menú + barra + loader).
// RBAC en dos capas (defensa en profundidad, patrón Guard): middleware.ts redirige antes de renderizar y este layout
// (Server Component) vuelve a comprobar la sesión; si no es ADMIN ni VENDOR responde 404 real (no revela que el panel
// existe). Las secciones permitidas al VENDOR (VENDOR_PANEL_ROUTES) las filtra middleware.ts.
// SEO: noindex (área privada). Rendimiento: sin el header/footer de la tienda (menos HTML y JS por página).
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/shared/lib/auth-config";
import { PANEL_ROLES } from "@/shared/constants/routes";
import { initPage } from "@/shared/lib/i18n/server";
import { PanelFrame } from "@/widgets/panel/PanelFrame";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

// "template" => cada página aporta su título y el layout agrega el sufijo del panel
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "admin" });
  return { title: { template: `%s · ${t("title")}`, default: t("title") }, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children, params }: Props) {
  await initPage(params);
  const session = await auth();
  if (!PANEL_ROLES.some((role) => session?.user.roles.includes(role))) notFound(); // Guard RBAC del lado del servidor

  // Marco ÚNICO (menú lateral + barra superior + loader): el mismo de "Mi cuenta" y del chatbot, y espejo del de Nuxt
  return <PanelFrame>{children}</PanelFrame>;
}
