// layout.tsx (account) => hub "Mi cuenta" dentro del MISMO marco del panel (PanelFrame): las secciones de la cuenta son
// ítems del grupo "Mi cuenta" del menú lateral general (antes tenía otro menú, otra barra y otro diseño).
// Rutas privadas: middleware.ts redirige a /login si no hay sesión.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { PanelFrame } from "@/widgets/panel/PanelFrame";
import AuthBanner from "@/widgets/auth/AuthBanner"; // Aviso de sesión vencida
import { initPage } from "@/shared/lib/i18n/server";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

// "template" => cada página define solo su título y el layout agrega el sufijo; noindex: datos personales
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "account" });
  return { title: { template: `%s · ${t("title")}`, default: t("title") }, robots: { index: false, follow: false } };
}

export default async function AccountLayout({ children, params }: Props) {
  await initPage(params);
  return (
    <PanelFrame banner={<AuthBanner />}>{children}</PanelFrame>
  );
}
