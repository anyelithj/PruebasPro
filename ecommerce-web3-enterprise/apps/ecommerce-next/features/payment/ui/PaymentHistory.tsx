// PaymentHistory.tsx => historial de pagos del usuario en tabla accesible (caption + th scope) y responsive.
"use client";

import { useState } from "react";
import { usePayments } from "../api/payment.api";
import { PaymentStatus } from "./PaymentStatus";
import { useTranslations } from "next-intl";
import { useFormat } from "@/shared/hook/useFormat";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Button } from "@/shared/ui/Button";

export function PaymentHistory() {
  const t = useTranslations("payment.history");
  const { money, dateTime } = useFormat();
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePayments(page);
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const payments = data?.data ?? [];
  if (payments.length === 0) return <p className="text-sm text-slate-600">{t("empty")}</p>;

  return (
    // "overflow-x-auto" => la tabla se desplaza en móviles sin romper el layout
    <div className="flex flex-col gap-3 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" className="py-2">{t("date")}</th>
            <th scope="col">{t("amount")}</th>
            <th scope="col">{t("refunded")}</th>
            <th scope="col">{t("status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td className="py-2">{dateTime(payment.createdAt)}</td>
              <td>{money(payment.amountCents, payment.currency)}</td>
              <td>{payment.refundedCents > 0 ? money(payment.refundedCents, payment.currency) : "—"}</td>
              <td>
                <PaymentStatus status={payment.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-between">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("previous")}
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}
