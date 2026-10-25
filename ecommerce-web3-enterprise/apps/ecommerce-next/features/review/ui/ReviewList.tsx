// ReviewList.tsx => lista paginada de reseñas (producto o "mis reseñas") con compra verificada y respuesta del vendedor.
"use client";

import { useReviews, useDeleteReview, type Review } from "../api/review.api";
import { useReviewFilter } from "../model/review.store";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { useTranslations } from "next-intl";
import { useFormat } from "@/shared/hook/useFormat";
import { toast } from "@/shared/ui/Toast";

// Tono visual por estado; el texto sale de messages/*.json -> review.status.<ESTADO>
const STATUS_TONE: Record<Review["status"], "success" | "warning" | "danger"> = { APPROVED: "success", PENDING: "warning", REJECTED: "danger" };

export function ReviewList({ productId, mine = false }: { productId?: string; mine?: boolean }) {
  const t = useTranslations("review");
  const { date } = useFormat();
  const { rating, page, setPage } = useReviewFilter();
  const { data, isLoading, isError } = useReviews({ ...(productId ? { productId } : {}), ...(rating ? { rating } : {}), mine, page });
  const deleteReview = useDeleteReview();

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (isError) return <p role="alert" className="text-sm text-red-600">{t("loadError")}</p>;
  const reviews = data?.data ?? [];
  if (reviews.length === 0) return <p className="text-sm text-slate-600">{mine ? t("emptyMine") : t("empty")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-slate-200">
        {reviews.map((review) => (
          <li key={review.id} className="flex flex-col gap-2 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true" className="text-amber-500">
                {"★".repeat(review.rating)}
                <span className="text-slate-300">{"★".repeat(5 - review.rating)}</span>
              </span>
              <span className="sr-only">{t("stars", { count: review.rating })}</span>
              <h3 className="font-medium text-slate-900">{review.title}</h3>
              {review.isVerifiedPurchase && <Badge tone="success">{t("verified")}</Badge>}
              {mine && <Badge tone={STATUS_TONE[review.status]}>{t(`status.${review.status}`)}</Badge>}
            </div>
            <p className="text-sm text-slate-700">{review.body}</p>
            <p className="text-xs text-slate-500">
              {mine ? review.productName : review.author.name} · <time dateTime={review.createdAt}>{date(review.createdAt)}</time>
            </p>
            {review.vendorReply && (
              <blockquote className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{t("vendorReply")}</p>
                {review.vendorReply}
              </blockquote>
            )}
            {mine && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start text-red-600"
                loading={deleteReview.isPending && deleteReview.variables === review.id}
                onClick={() => deleteReview.mutate(review.id, { onSuccess: () => toast.success(t("deleted")) })}
              >
                {t("delete")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("previous")}
          </Button>
          <span className="text-sm text-slate-600">
            {t("page", { page, total: data.meta.totalPages })}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}
