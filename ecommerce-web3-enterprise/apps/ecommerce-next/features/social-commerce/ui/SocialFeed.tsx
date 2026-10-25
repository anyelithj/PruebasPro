// SocialFeed.tsx => feed de publicaciones shoppable con filtro por red y avisos en vivo de nuevas publicaciones.
// La primera página llega renderizada del servidor (SSR, "initial"); TanStack Query la reutiliza como caché inicial.
// Tiempo real (Observer): mientras el feed está en pantalla se abre UN socket de Socket.io a la sala pública
// "social:feed"; al publicarse algo se muestra un aviso y el usuario decide cuándo cargarlo (el contenido no salta).
// Ahorro: socket.io-client se descarga solo en esta página (import dinámico), usa WebSocket directo (sin long-polling)
// y se cierra al salir del feed.
"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/shared/lib/i18n/navigation";
import { routes } from "@/shared/constants/routes";
import { config } from "@/shared/constants/config";
import { queryKeys } from "@/shared/lib/query-client";
import { cn } from "@/shared/lib/cn";
import { EmptyState } from "@/shared/ui/EmptyState";
import { getSocialFeed, type SocialFeedPage, type SocialPlatform } from "../api/social.api";
import { useSocialFeedState } from "../model/social.store";
import type { SocialFeedQuery } from "../lib/social.validator";
import { SocialPost } from "./SocialPost";

const PLATFORMS: Array<SocialPlatform | "ALL"> = ["ALL", "INSTAGRAM", "FACEBOOK", "TIKTOK"];

// pageHref => enlace de paginación conservando el filtro de influencer (URLs indexables: SEO)
function pageHref(query: SocialFeedQuery, page: number): string {
  const params = new URLSearchParams({
    page: String(page),
    ...(query.influencer ? { influencer: query.influencer } : {}),
  });
  return `${routes.social()}?${params.toString()}`;
}

export function SocialFeed({
  initial,
  query,
}: {
  initial: SocialFeedPage;
  query: SocialFeedQuery;
}) {
  const t = useTranslations("social");
  const queryClient = useQueryClient();
  const { platform, pendingPosts, setPlatform, postPublished, postsRevealed } =
    useSocialFeedState();
  const { data } = useQuery({
    queryKey: queryKeys.socialFeed(query),
    queryFn: () => getSocialFeed(query),
    initialData: initial,
  });

  useEffect(() => {
    let cancelled = false;
    let disconnect = () => {};
    void import("socket.io-client").then(({ io }) => {
      if (cancelled) return; // El usuario salió antes de que terminara la descarga del módulo
      const socket = io(config.socketUrl, { path: "/ws/socket.io", transports: ["websocket"] });
      socket.on("connect", () => socket.emit("feed:subscribe")); // También al reconectar
      socket.on("social:published", () => postPublished());
      disconnect = () => socket.disconnect();
    });
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [postPublished]);

  const reveal = () => {
    postsRevealed();
    void queryClient.invalidateQueries({ queryKey: ["social-feed"] });
  };

  // Filtro por red en memoria sobre la página ya descargada (0 peticiones extra)
  const posts = data.data.filter((post) => platform === "ALL" || post.platforms.includes(platform));
  const totalPages = data.meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6">
      {/* role="status" => el aviso de nuevas publicaciones se anuncia sin mover el foco */}
      <div role="status" aria-live="polite">
        {pendingPosts > 0 && (
          <button
            type="button"
            onClick={reveal}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t("newPosts", { count: pendingPosts })}
          </button>
        )}
      </div>

      <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
        {PLATFORMS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={platform === item}
            onClick={() => setPlatform(item)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              platform === item
                ? "border-slate-900 bg-slate-900 text-slate-50"
                : "border-slate-300 hover:bg-slate-50"
            )}
          >
            {t(`platform.${item}`)}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState title={t("empty")} action={{ label: t("goShopping"), href: routes.products }} />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <SocialPost post={post} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between text-sm">
          {query.page > 1 ? (
            <Link
              href={pageHref(query, query.page - 1)}
              rel="prev"
              className="underline-offset-4 hover:underline"
            >
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-600">
            {t("page", { page: query.page, total: totalPages })}
          </span>
          {query.page < totalPages ? (
            <Link
              href={pageHref(query, query.page + 1)}
              rel="next"
              className="underline-offset-4 hover:underline"
            >
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
