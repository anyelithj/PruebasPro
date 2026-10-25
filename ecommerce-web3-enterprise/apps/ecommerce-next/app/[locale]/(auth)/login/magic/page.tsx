// page.tsx (/login/magic?token=...) => Server Component: destino del enlace mágico del correo (RF-01.3).
// El canje del token ocurre en el navegador (MagicLinkLogin) porque crea la sesión de next-auth (cookie httpOnly).
// SEO: noindex (página de un solo uso). "Suspense" => requerido por Next 15 para Client Components con useSearchParams.
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import MagicLinkLogin from "@/features/auth/ui/MagicLinkLogin";
import { initPage } from "@/shared/lib/i18n/server";
import { firstParam, type PageProps } from "@/shared/types/next.types";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth.magic" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function MagicLinkPage({ params, searchParams }: PageProps) {
  await initPage(params);
  const t = await getTranslations("auth.magic");
  const token = firstParam((await searchParams)["token"]) ?? ""; // Sin token => el componente muestra el error
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <h1 className="text-xl font-medium text-foreground">{t("title")}</h1>
      <Suspense>
        <MagicLinkLogin token={token} />
      </Suspense>
    </div>
  );
}
