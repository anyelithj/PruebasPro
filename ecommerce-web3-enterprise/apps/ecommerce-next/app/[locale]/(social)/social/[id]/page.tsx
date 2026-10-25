// page.tsx (/social/[id]) => detalle de una publicación shoppable: ISR 60 s, metadatos Open Graph con la imagen de la
// publicación (vista previa al compartir), JSON-LD SocialMediaPosting, productos etiquetados y botón de compartir.
// Server Component: solo SocialShare y las tarjetas de producto envían JS al navegador.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSocialPost } from "@/features/social-commerce/api/social.api";
import { SocialPost } from "@/features/social-commerce/ui/SocialPost";
import { SocialShare } from "@/features/social-commerce/ui/SocialShare";
import { ProductCard } from "@/features/product/ui/ProductCard";
import { JsonLd } from "../../../_components/JsonLd";
import { absoluteUrl, alternates, initPage } from "@/shared/lib/i18n/server";
import { OG_LOCALE, type Locale } from "@/shared/lib/i18n/routing";
import { routes } from "@/shared/constants/routes";
import type { PageProps } from "@/shared/types/next.types";

export const revalidate = 60;

type Props = PageProps<{ id: string }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params;
  const post = await getSocialPost(id);
  if (!post) return { title: (await getTranslations({ locale, namespace: "social" }))("notFound") };
  const description = post.caption.slice(0, 155);
  const seo = alternates(routes.socialPost(post.id), locale as Locale);
  return {
    title: post.influencer
      ? `${post.influencer.displayName} · ${description.slice(0, 50)}`
      : description.slice(0, 60),
    description,
    alternates: seo,
    openGraph: {
      type: "article",
      description,
      url: seo.canonical,
      locale: OG_LOCALE[locale as Locale],
      images: [{ url: post.mediaUrl, alt: post.mediaAlt }],
    },
  };
}

export default async function SocialPostPage({ params }: Props) {
  const locale = await initPage(params);
  const t = await getTranslations("social");
  const post = await getSocialPost((await params).id);
  if (!post) notFound(); // 404 real (SEO) con la página not-found.tsx

  const url = absoluteUrl(routes.socialPost(post.id), locale);
  return (
    <article className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SocialMediaPosting",
          headline: post.caption.slice(0, 110),
          image: post.mediaUrl,
          datePublished: post.publishedAt ?? post.createdAt,
          url,
          ...(post.influencer
            ? {
                author: {
                  "@type": "Person",
                  name: post.influencer.displayName,
                  alternateName: `@${post.influencer.handle}`,
                },
              }
            : {}),
        }}
      />
      <div className="flex flex-col gap-4">
        <SocialPost post={post} detailed />
        <SocialShare url={url} title={post.caption.slice(0, 100)} />
      </div>
      <section aria-labelledby="tagged-title" className="flex flex-col gap-4">
        <h2 id="tagged-title" className="text-xl font-semibold">
          {t("taggedProducts", { count: post.products.length })}
        </h2>
        <ul className="grid grid-cols-2 gap-4">
          {post.products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
