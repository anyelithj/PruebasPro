// page.tsx (/account) => "Mi perfil": datos personales, celular, métodos de pago, seguridad (contraseña/2FA/wallet/
// exportar datos/baja), notificaciones, visualización e idioma. Los pedidos tienen su propia sección (/account/orders)
// y las direcciones se eligen o crean al hacer el pedido (paso "Dirección" del checkout).
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ProfileSettings } from "@/features/settings/ui/ProfileSettings";
import { SecuritySettings } from "@/features/settings/ui/SecuritySettings";
import { PhoneVerification } from "@/features/settings/ui/PhoneVerification"; // RF-01.1
import { SavedPaymentMethods } from "@/features/payment/ui/SavedPaymentMethods"; // RF-02.3
import { NotifSettings } from "@/features/settings/ui/NotifSettings";
import { ThemeSettings } from "@/features/settings/ui/ThemeSettings";
import { LanguageSwitcher } from "@/features/settings/ui/LanguageSwitcher";
import { AccountHeading, accountMetadata } from "./AccountSection";
import { initPage } from "@/shared/lib/i18n/server";
import type { PageProps } from "@/shared/types/next.types";

export const generateMetadata = accountMetadata("settings");

export default async function AccountPage({ params }: PageProps) {
  await initPage(params);
  const t = await getTranslations("account.pages");
  return (
    <>
      <AccountHeading>{t("settings")}</AccountHeading>
      <ProfileSettings />
      <PhoneVerification />
      <SavedPaymentMethods />
      <SecuritySettings />
      <NotifSettings />
      <ThemeSettings />
      <Suspense>
        <LanguageSwitcher />
      </Suspense>
    </>
  );
}
