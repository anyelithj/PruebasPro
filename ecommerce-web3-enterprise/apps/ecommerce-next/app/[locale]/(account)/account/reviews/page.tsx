// page.tsx (/account/reviews) => reseñas del usuario con su estado de moderación (modo "mine" de ReviewList).
import { getTranslations } from "next-intl/server";
import { ReviewList } from "@/features/review/ui/ReviewList";
import { AccountHeading, accountMetadata } from "../AccountSection";
import { initPage } from "@/shared/lib/i18n/server";
import type { PageProps } from "@/shared/types/next.types";

export const generateMetadata = accountMetadata("reviews");

export default async function ReviewsPage({ params }: PageProps) {
  await initPage(params);
  const t = await getTranslations("account.pages");
  return (
    <>
      <AccountHeading>{t("reviews")}</AccountHeading>
      <ReviewList mine />
    </>
  );
}
