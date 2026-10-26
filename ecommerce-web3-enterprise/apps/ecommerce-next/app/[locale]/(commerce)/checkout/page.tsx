// page.tsx (/checkout) => entrada al pago desde el carrito de la TIENDA (Nuxt): el carrito vive en Express, así que
// aquí se inicia la saga (POST /checkout reserva el stock) con el cupón, los puntos y el canal que envía la tienda en la
// URL, y se pasa al paso de envío. Server Component mínimo + Client Component que hace la petición con la sesión.
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/shared/lib/i18n/server";
import { StartCheckoutFromCart } from "@/features/checkout/ui/ConfirmButton";
import { config } from "@/shared/constants/config";
import type { PageProps } from "@/shared/types/next.types";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "checkout.page" });
  return { title: t("metaAddress"), robots: { index: false } }; // Área privada: no se indexa
}

export default async function CheckoutIndexPage({ params }: PageProps) {
  const locale = await initPage(params);
  // Carrito de la tienda en el mismo idioma (Nuxt: español sin prefijo, inglés /en)
  const storeCartUrl = `${config.cmsUrl}${locale === "es" ? "" : `/${locale}`}/cart`;
  return (
    <div className="mx-auto max-w-xl py-16">
      {/* "Suspense" => requerido por Next 16 para Client Components que leen useSearchParams */}
      <Suspense>
        <StartCheckoutFromCart storeCartUrl={storeCartUrl} />
      </Suspense>
    </div>
  );
}
