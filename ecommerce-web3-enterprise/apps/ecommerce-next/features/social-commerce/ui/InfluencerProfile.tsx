// InfluencerProfile.tsx => tarjeta de perfil de un influencer: avatar, nombre, @handle, publicaciones y productos
// etiquetados; enlaza a su feed filtrado. Server Component (sin JS en el navegador). Patrón: Presentational Component.
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/shared/lib/i18n/navigation";
import { routes } from "@/shared/constants/routes";
import type { Influencer } from "../api/social.api";

interface InfluencerProfileProps {
  influencer: Influencer;
  posts: number;
  products: number;
}

export function InfluencerProfile({ influencer, posts, products }: InfluencerProfileProps) {
  const t = useTranslations("social.influencers");
  return (
    <article className="flex items-center gap-4 rounded-lg border border-slate-200 p-4">
      {influencer.avatarUrl ? (
        <Image
          src={influencer.avatarUrl}
          alt=""
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 shrink-0 rounded-full object-cover"
        />
      ) : (
        // Iniciales como respaldo (decorativas: el nombre ya está en el texto)
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200 text-lg font-semibold text-slate-600"
        >
          {influencer.displayName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="truncate font-semibold text-slate-900">{influencer.displayName}</h2>
        <p className="text-sm text-slate-500">@{influencer.handle}</p>
        <p className="text-xs text-slate-600">{t("stats", { posts, products })}</p>
        <Link
          href={routes.social(influencer.handle)}
          className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
        >
          {t("viewPosts", { name: influencer.displayName })}
        </Link>
      </div>
    </article>
  );
}
