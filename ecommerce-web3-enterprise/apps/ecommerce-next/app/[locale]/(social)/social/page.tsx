// page.tsx (/social) => feed social shoppable (SSR): la primera página llega como HTML (rápido e indexable) y
// SocialFeed la hidrata para filtros y avisos en vivo. ?page= y ?influencer= se validan con Zod (entrada del usuario).
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSocialFeed } from "@/features/social-commerce/api/social.api";
import { SocialFeed } from "@/features/social-commerce/ui/SocialFeed";
import { socialFeedQuerySchema } from "@/features/social-commerce/lib/social.validator";
import { alternates, initPage } from "@/shared/lib/i18n/server";
import type { Locale } from "@/shared/lib/i18n/routing";
import { routes } from "@/shared/constants/routes";
import { Link } from "@/shared/lib/i18n/navigation";
import type { PageProps } from "@/shared/types/next.types";

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { influencer } = socialFeedQuerySchema.parse(await searchParams);
  const t = await getTranslations({ locale, namespace: "social" });
  const title = influencer ? t("titleInfluencer", { handle: influencer }) : t("title");
  return {
    title,
    description: t("description"),
    alternates: alternates(routes.social(influencer), locale as Locale),
  };
}

export default async function SocialPage({ params, searchParams }: PageProps) {
  await initPage(params);
  const t = await getTranslations("social");
  const query = socialFeedQuerySchema.parse(await searchParams);
  // Si Express no responde, la página sigue mostrando su estructura con el estado vacío (degradación elegante)
  const initial = await getSocialFeed(query).catch(() => ({ data: [] }));
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {query.influencer ? t("titleInfluencer", { handle: query.influencer }) : t("title")}
          </h1>
          <p className="text-sm text-slate-600">{t("description")}</p>
        </div>
        <Link
          href={routes.influencers}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("influencers.title")}
        </Link>
      </header>
      <SocialFeed initial={initial} query={query} />
    </section>
  );
}
