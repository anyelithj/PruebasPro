// page.tsx (/account/orders/[id]) => detalle del pedido: estado, tracking, factura, cancelación y reembolso.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrderDetail } from "@/features/order/ui/OrderDetail";
import { Link } from "@/shared/lib/i18n/navigation";
import { initPage } from "@/shared/lib/i18n/server";
import type { PageProps } from "@/shared/types/next.types";
import { routes } from "@/shared/constants/routes";
import { Button } from "@/shared/ui/Button";

type Props = PageProps<{ id: string }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "account.pages" });
  return { title: t("orderDetail") };
}

export default async function OrderPage({ params }: Props) {
  await initPage(params);
  const t = await getTranslations("account.pages");
  const { id } = await params;
  return (
    <>
      {/* "Volver" como botón secundario con flecha (mismo estilo que el resto del panel); el título lo pone OrderDetail */}
      <Button asChild variant="secondary" className="self-start">
        <Link href={routes.orders}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {t("backToOrders")}
        </Link>
      </Button>
      <OrderDetail orderId={id} />
    </>
  );
}
