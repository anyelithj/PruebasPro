// SocialPost.tsx => tarjeta de una publicación shoppable: imagen, influencer, texto, redes y productos etiquetados.
// "detailed" => versión completa del detalle (texto entero, imagen prioritaria para el LCP y métricas).
// Sin estado ni efectos: en el detalle se renderiza en el servidor (0 KB de JS) y el feed lo reutiliza en el cliente.
// Patrón: Presentational Component. Paradigma: declarativo.
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/shared/lib/i18n/navigation";
import { routes } from "@/shared/constants/routes";
import { Badge } from "@/shared/ui/Badge";
import { useFormat } from "@/shared/hook/useFormat";
import type { SocialPost as SocialPostData } from "../api/social.api";

const METRICS = ["likes", "comments", "clicks", "purchases"] as const;

export function SocialPost({
  post,
  detailed = false,
}: {
  post: SocialPostData;
  detailed?: boolean;
}) {
  const t = useTranslations("social");
  const { date } = useFormat();
  const publishedAt = post.publishedAt ?? post.createdAt;
  const Heading = detailed ? "h1" : "h2"; // Jerarquía de títulos correcta en feed y detalle (a11y + SEO)

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-background">
      {/* "unoptimized" => las imágenes de redes pueden venir de cualquier dominio HTTPS; "aspect-square" reserva el
          espacio antes de cargar (sin saltos de layout, CLS = 0) */}
      <div className="relative aspect-square bg-slate-100">
        <Image
          src={post.mediaUrl}
          alt={post.mediaAlt}
          fill
          unoptimized
          priority={detailed}
          sizes={
            detailed
              ? "(min-width: 1024px) 50vw, 100vw"
              : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          }
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {post.influencer && (
          <Link
            href={routes.social(post.influencer.handle)}
            className="flex items-center gap-2 text-sm hover:underline"
          >
            {post.influencer.avatarUrl && (
              <Image
                src={post.influencer.avatarUrl}
                alt=""
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 rounded-full object-cover"
              />
            )}
            <span className="font-medium text-slate-900">{post.influencer.displayName}</span>
            <span className="text-slate-500">@{post.influencer.handle}</span>
          </Link>
        )}
        <Heading
          className={
            detailed
              ? "whitespace-pre-line text-base text-slate-800"
              : "line-clamp-3 text-sm text-slate-800"
          }
        >
          {post.caption}
        </Heading>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <time dateTime={publishedAt}>{date(publishedAt)}</time>
          {post.platforms.map((platform) => (
            <Badge key={platform}>{t(`platform.${platform}`)}</Badge>
          ))}
        </div>
        {detailed ? (
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {METRICS.map((metric) => (
              <div key={metric} className="rounded-md bg-slate-50 p-2 text-center">
                <dt className="text-xs text-slate-500">{t(`metrics.${metric}`)}</dt>
                <dd className="font-semibold text-slate-900">{post.metrics[metric]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Link
            href={routes.socialPost(post.id)}
            className="mt-auto text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            {t("shopPost", { count: post.products.length })}
          </Link>
        )}
      </div>
    </article>
  );
}
