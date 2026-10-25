// page.tsx (/influencers) => influencers que colaboran con la tienda (SSR + ISR 5 min). Express no tiene un listado
// propio de influencers: se agrupan desde las publicaciones del feed (un Map por handle, una sola petición).
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSocialFeed, type Influencer } from "@/features/social-commerce/api/social.api";
import { InfluencerProfile } from "@/features/social-commerce/ui/InfluencerProfile";
import { EmptyState } from "@/shared/ui/EmptyState";
import { alternates, initPage } from "@/shared/lib/i18n/server";
import type { Locale } from "@/shared/lib/i18n/routing";
import { routes } from "@/shared/constants/routes";
import type { PageProps } from "@/shared/types/next.types";

export const revalidate = 300;

// ponytail: solo las 100 publicaciones más recientes; endpoint GET /social/influencer en Express si crecen más
const POSTS_SCANNED = 100;

interface InfluencerSummary {
  influencer: Influencer;
  posts: number;
  products: Set<string>; // Set => cada producto se cuenta una vez aunque aparezca en varias publicaciones
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "social.influencers" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(routes.influencers, locale as Locale),
  };
}

export default async function InfluencersPage({ params }: PageProps) {
  await initPage(params);
  const t = await getTranslations("social.influencers");
  const { data } = await getSocialFeed({ page: 1, limit: POSTS_SCANNED }).catch(() => ({
    data: [],
  }));

  const byHandle = new Map<string, InfluencerSummary>();
  for (const post of data) {
    if (!post.influencer) continue;
    const summary = byHandle.get(post.influencer.handle) ?? {
      influencer: post.influencer,
      posts: 0,
      products: new Set<string>(),
    };
    summary.posts += 1;
    post.products.forEach((product) => summary.products.add(product.id));
    byHandle.set(post.influencer.handle, summary);
  }
  const influencers = [...byHandle.values()].sort((a, b) => b.posts - a.posts); // Más activos primero

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-slate-600">{t("description")}</p>
      </header>
      {influencers.length === 0 ? (
        <EmptyState title={t("empty")} action={{ label: t("goFeed"), href: routes.social() }} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {influencers.map(({ influencer, posts, products }) => (
            <li key={influencer.handle}>
              <InfluencerProfile influencer={influencer} posts={posts} products={products.size} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
