// page.tsx (/account/loyalty) => programa de fidelidad: saldo, niveles, historial de puntos e insignias NFT.
import { getTranslations } from "next-intl/server";
import { PointsBalance } from "@/features/loyalty/ui/PointsBalance";
import { LoyaltyTiers } from "@/features/loyalty/ui/LoyaltyTiers";
import { RewardsHistory } from "@/features/loyalty/ui/RewardsHistory";
import { NFTBadgeGallery } from "@/features/loyalty/ui/NFTBadgeGallery";
import { Achievements, LoyaltyBenefits, Ranking, Referral } from "@/features/loyalty/ui/LoyaltyExtras"; // RF-14.1/14.4/14.5/14.9
import { AccountHeading, accountMetadata } from "../AccountSection";
import { initPage } from "@/shared/lib/i18n/server";
import type { PageProps } from "@/shared/types/next.types";

export const generateMetadata = accountMetadata("loyalty");

export default async function LoyaltyPage({ params }: PageProps) {
  await initPage(params);
  const t = await getTranslations("account.pages");
  return (
    <>
      <AccountHeading>{t("loyalty")}</AccountHeading>
      <PointsBalance />
      <LoyaltyBenefits />
      <LoyaltyTiers />
      <Achievements />
      <Ranking />
      <Referral />
      <NFTBadgeGallery />
      <RewardsHistory />
    </>
  );
}
